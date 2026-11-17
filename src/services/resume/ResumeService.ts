import {
  FileTooLargeError,
  ParsingError,
  ResumeError,
  ResumeStorageError,
  UnsupportedFileError,
} from "@/lib/errors/ResumeError";
import {
  isAcceptedResumeMimeType,
  MAX_RESUME_BYTES,
} from "@/lib/resume/constants";
import { buildResumeInfo } from "@/lib/resume/presentation";
import type { ResumeInfo } from "@/models/ResumeInfo";
import type {
  IResumeRepository,
  UpsertResumeProfileInput,
} from "@/repositories/ResumeRepository";
import {
  registerResumeInputSchema,
  type RegisterResumeInput,
} from "@/lib/validation/resumeSchemas";
import type { IResumeParser } from "./ResumeParser";
import type { IResumeStorageService } from "./ResumeStorageService";
import type { ResumeTextExtractor } from "./TextExtractor";

/** Created lazily so status reads work even when the LLM key is absent. */
export type ResumeParserProvider = () => IResumeParser;

/**
 * Orchestrates the resume lifecycle: register an upload, run the
 * extraction/parsing pipeline, persist status transitions, and clean up the
 * previous resume when a new one replaces it.
 */
export class ResumeService {
  private readonly repository: IResumeRepository;
  private readonly storage: IResumeStorageService;
  private readonly parserProvider: ResumeParserProvider;
  private readonly extractors: ResumeTextExtractor;

  constructor(
    repository: IResumeRepository,
    storage: IResumeStorageService,
    parserProvider: ResumeParserProvider,
    extractors: ResumeTextExtractor,
  ) {
    this.repository = repository;
    this.storage = storage;
    this.parserProvider = parserProvider;
    this.extractors = extractors;
  }

  /** Latest resume plus its parse state, safe to serialise to the client. */
  async getState(userId: string): Promise<ResumeInfo> {
    const resume = await this.repository.findLatestByUserId(userId);
    if (!resume) return buildResumeInfo(null, null);

    const profile = await this.repository.findProfileByResumeId(userId, resume.id);
    return buildResumeInfo(resume, profile);
  }

  /**
   * Called after the browser has uploaded the file directly to storage.
   * Re-verifies ownership and the object's real size/type, saves the row, and
   * removes the previous resume and its parsed data.
   */
  async registerUpload(userId: string, input: RegisterResumeInput): Promise<ResumeInfo> {
    const metadata = registerResumeInputSchema.parse(input);
    this.assertOwnedPath(userId, metadata.filePath);

    const object = await this.storage.stat(metadata.filePath);
    if (object.size > MAX_RESUME_BYTES) throw new FileTooLargeError();
    if (object.size <= 0) throw new ResumeStorageError();

    const mimeType =
      object.contentType && isAcceptedResumeMimeType(object.contentType)
        ? object.contentType
        : metadata.mimeType;

    if (object.contentType && !isAcceptedResumeMimeType(object.contentType)) {
      throw new UnsupportedFileError();
    }

    if (!isAcceptedResumeMimeType(mimeType)) throw new UnsupportedFileError();

    const previous = await this.repository.listByUserId(userId);

    const resume = await this.repository.insert(userId, {
      filePath: metadata.filePath,
      fileName: metadata.fileName,
      mimeType,
      size: object.size,
    });

    const profile = await this.repository.upsertProfile(userId, resume.id, {
      status: "pending",
      errorMessage: null,
    });

    // Rows cascade-delete the old parsed profiles; files are removed after the
    // database switch so a failed cleanup never loses the new resume.
    await this.repository.deleteAllExcept(userId, resume.id);
    await this.deleteFiles(
      previous
        .filter((item) => item.id !== resume.id)
        .map((item) => item.filePath),
    );

    return buildResumeInfo(resume, profile);
  }

  /**
   * Downloads, extracts, parses, and stores structured data. Safe to re-run:
   * the profile is upserted by `resume_id`, so retries update the same row.
   */
  async parse(userId: string, resumeId: string): Promise<ResumeInfo> {
    const resume = await this.repository.findByIdForUser(userId, resumeId);
    if (!resume) {
      throw new ResumeError("resume_not_found");
    }

    await this.transition(userId, resumeId, {
      status: "processing",
      errorMessage: null,
    });

    try {
      const file = await this.storage.download(resume.filePath);
      if (file.size > MAX_RESUME_BYTES) throw new FileTooLargeError();

      const text = await this.extractors.extract(file.bytes, resume.mimeType);
      const parsed = await this.parserProvider().parse(text);

      const profile = await this.repository.upsertProfile(userId, resumeId, {
        status: "completed",
        errorMessage: null,
        rawText: text,
        parsed,
      });

      return buildResumeInfo(resume, profile);
    } catch (error) {
      const resumeError = toResumeError(error);
      console.error("Resume parsing failed", {
        resumeId,
        code: resumeError.code,
        // Root cause only (provider error text); never the resume contents.
        detail: describeCause(resumeError),
      });
      await this.transition(userId, resumeId, {
        status: "failed",
        errorMessage: resumeError.message,
      }).catch((transitionError: unknown) => {
        console.error("Could not persist resume failure", {
          resumeId,
          reason: transitionError instanceof Error ? transitionError.name : "unknown",
        });
      });
      throw resumeError;
    }
  }

  private async transition(
    userId: string,
    resumeId: string,
    input: UpsertResumeProfileInput,
  ): Promise<void> {
    await this.repository.upsertProfile(userId, resumeId, input);
  }

  private async deleteFiles(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      try {
        await this.storage.delete(path);
      } catch (error) {
        // The new resume is already live; a failed cleanup must not roll it
        // back. Log only the error type, never the object path.
        console.error("Could not delete previous resume file", {
          reason: error instanceof Error ? error.name : "unknown",
        });
      }
    }
  }

  private assertOwnedPath(userId: string, filePath: string): void {
    const segments = filePath.split("/");
    const [folder] = segments;
    const invalid = segments.some(
      (segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"),
    );

    if (folder !== userId || segments.length < 2 || invalid) {
      throw new ResumeStorageError({
        message: "We couldn't verify that upload. Please try again.",
      });
    }
  }
}

function toResumeError(error: unknown): ResumeError {
  if (error instanceof ResumeError) return error;
  return new ParsingError({ cause: error });
}

/** Deepest cause summary for logs: provider text only, never resume content. */
function describeCause(error: unknown): string {
  let current: unknown = error;
  let summary = error instanceof Error ? error.name : "unknown";
  let depth = 0;

  while (current instanceof Error && depth < 5) {
    summary = `${current.name}: ${current.message}`;
    current = (current as { cause?: unknown }).cause;
    depth += 1;
  }

  return summary.slice(0, 300);
}
