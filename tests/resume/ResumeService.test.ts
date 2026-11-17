import { describe, expect, it, vi } from "vitest";
import {
  ExtractionError,
  FileTooLargeError,
  ParsingError,
  ResumeError,
  ResumeStorageError,
} from "@/lib/errors/ResumeError";
import { MAX_RESUME_BYTES, PDF_MIME_TYPE } from "@/lib/resume/constants";
import type { ResumeInfo } from "@/models/ResumeInfo";
import type { IResumeRepository } from "@/repositories/ResumeRepository";
import type { IResumeParser } from "@/services/resume/ResumeParser";
import { ResumeService } from "@/services/resume/ResumeService";
import type { IResumeStorageService } from "@/services/resume/ResumeStorageService";
import type { ResumeTextExtractor } from "@/services/resume/TextExtractor";
import { makeProfile, makeResume, sampleParsedResume, sampleResume } from "./fixtures";

function createRepository(): IResumeRepository {
  return {
    listByUserId: vi.fn(),
    findLatestByUserId: vi.fn(),
    findByIdForUser: vi.fn(),
    insert: vi.fn(),
    deleteById: vi.fn(),
    deleteAllExcept: vi.fn(),
    findProfileByResumeId: vi.fn(),
    upsertProfile: vi.fn(),
  };
}

function createStorage(): IResumeStorageService {
  return {
    upload: vi.fn(),
    delete: vi.fn(),
    getSignedUrl: vi.fn(),
    download: vi.fn(),
    stat: vi.fn(),
  };
}

function createService() {
  const repository = createRepository();
  const storage = createStorage();
  const parser: IResumeParser = { parse: vi.fn() };
  const extractors: ResumeTextExtractor = { extract: vi.fn() };
  const service = new ResumeService(repository, storage, () => parser, extractors);

  return { repository, storage, parser, extractors, service };
}

const validUpload = {
  filePath: "user-1/abc-resume.pdf",
  fileName: "resume.pdf",
  mimeType: PDF_MIME_TYPE,
  size: 4096,
} as const;

describe("ResumeService.getState", () => {
  it("reports not_uploaded when the user has no resume", async () => {
    const { repository, service } = createService();
    vi.mocked(repository.findLatestByUserId).mockResolvedValue(null);

    const state = await service.getState("user-1");

    expect(state.status).toBe("not_uploaded");
    expect(state.resumeId).toBeNull();
    expect(repository.findProfileByResumeId).not.toHaveBeenCalled();
  });

  it("maps a completed profile to ready with highlights", async () => {
    const { repository, service } = createService();
    vi.mocked(repository.findLatestByUserId).mockResolvedValue(sampleResume);
    vi.mocked(repository.findProfileByResumeId).mockResolvedValue(makeProfile());

    const state = await service.getState("user-1");

    expect(state.status).toBe("ready");
    expect(state.highlights?.latestRole).toBe("Senior Engineer at Analytical Engines");
    expect(state.highlights?.topSkills).toContain("TypeScript");
    expect(state.highlights?.education).toContain("University of London");
  });
});

describe("ResumeService.registerUpload", () => {
  it("verifies the object, saves the row, and creates a pending profile", async () => {
    const { repository, storage, service } = createService();
    vi.mocked(storage.stat).mockResolvedValue({ size: 4096, contentType: PDF_MIME_TYPE });
    vi.mocked(repository.listByUserId).mockResolvedValue([]);
    vi.mocked(repository.insert).mockResolvedValue(sampleResume);
    vi.mocked(repository.upsertProfile).mockResolvedValue(
      makeProfile({ status: "pending", parsed: null }),
    );
    vi.mocked(repository.deleteAllExcept).mockResolvedValue([]);

    const state = await service.registerUpload("user-1", validUpload);

    expect(storage.stat).toHaveBeenCalledWith(validUpload.filePath);
    expect(repository.insert).toHaveBeenCalledWith("user-1", {
      filePath: validUpload.filePath,
      fileName: validUpload.fileName,
      mimeType: PDF_MIME_TYPE,
      size: 4096,
    });
    expect(repository.upsertProfile).toHaveBeenCalledWith(
      "user-1",
      sampleResume.id,
      { status: "pending", errorMessage: null },
    );
    expect(repository.deleteAllExcept).toHaveBeenCalledWith("user-1", sampleResume.id);
    expect(state.status).toBe("pending");
  });

  it("rejects a path outside the user's folder", async () => {
    const { repository, storage, service } = createService();

    await expect(
      service.registerUpload("user-1", {
        ...validUpload,
        filePath: "someone-else/abc-resume.pdf",
      }),
    ).rejects.toBeInstanceOf(ResumeStorageError);

    expect(storage.stat).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects an object larger than 5 MB", async () => {
    const { repository, storage, service } = createService();
    vi.mocked(storage.stat).mockResolvedValue({
      size: MAX_RESUME_BYTES + 1,
      contentType: PDF_MIME_TYPE,
    });

    await expect(service.registerUpload("user-1", validUpload)).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejects an object stored with a disallowed content type", async () => {
    const { storage, service } = createService();
    vi.mocked(storage.stat).mockResolvedValue({
      size: 100,
      contentType: "text/plain",
    });

    await expect(service.registerUpload("user-1", validUpload)).rejects.toBeInstanceOf(
      ResumeError,
    );
  });

  it("deletes the previous row and file when replacing a resume", async () => {
    const { repository, storage, service } = createService();
    const previous = makeResume({ id: "old-resume", file_path: "user-1/old.pdf" });
    vi.mocked(storage.stat).mockResolvedValue({ size: 4096, contentType: PDF_MIME_TYPE });
    vi.mocked(repository.listByUserId).mockResolvedValue([previous]);
    vi.mocked(repository.insert).mockResolvedValue(sampleResume);
    vi.mocked(repository.upsertProfile).mockResolvedValue(makeProfile({ status: "pending" }));
    vi.mocked(repository.deleteAllExcept).mockResolvedValue([previous]);

    await service.registerUpload("user-1", validUpload);

    expect(repository.deleteAllExcept).toHaveBeenCalledWith("user-1", sampleResume.id);
    expect(storage.delete).toHaveBeenCalledWith("user-1/old.pdf");
  });

  it("keeps the new resume when deleting the old file fails", async () => {
    const { repository, storage, service } = createService();
    const previous = makeResume({ id: "old-resume", file_path: "user-1/old.pdf" });
    vi.mocked(storage.stat).mockResolvedValue({ size: 4096, contentType: PDF_MIME_TYPE });
    vi.mocked(repository.listByUserId).mockResolvedValue([previous]);
    vi.mocked(repository.insert).mockResolvedValue(sampleResume);
    vi.mocked(repository.upsertProfile).mockResolvedValue(makeProfile({ status: "pending" }));
    vi.mocked(repository.deleteAllExcept).mockResolvedValue([previous]);
    vi.mocked(storage.delete).mockRejectedValue(new ResumeStorageError());
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.registerUpload("user-1", validUpload)).resolves.toMatchObject({
      status: "pending",
    });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("ResumeService.parse", () => {
  function arrangeSuccessfulParse() {
    const context = createService();
    vi.mocked(context.repository.findByIdForUser).mockResolvedValue(sampleResume);
    vi.mocked(context.storage.download).mockResolvedValue({
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      size: 4096,
      contentType: PDF_MIME_TYPE,
    });
    vi.mocked(context.extractors.extract).mockResolvedValue("Extracted resume text");
    vi.mocked(context.parser.parse).mockResolvedValue(sampleParsedResume);

    vi.mocked(context.repository.upsertProfile).mockImplementation(
      async (_userId, _resumeId, input) =>
        makeProfile({
          status: input.status,
          parsed: input.parsed ?? null,
          errorMessage: input.errorMessage ?? null,
        }),
    );

    return context;
  }

  it("runs processing -> completed and returns ready", async () => {
    const { repository, storage, extractors, parser, service } =
      arrangeSuccessfulParse();

    const state = await service.parse("user-1", sampleResume.id);

    expect(repository.findByIdForUser).toHaveBeenCalledWith("user-1", sampleResume.id);
    expect(storage.download).toHaveBeenCalledWith(sampleResume.filePath);
    expect(extractors.extract).toHaveBeenCalledWith(expect.any(Uint8Array), PDF_MIME_TYPE);
    expect(parser.parse).toHaveBeenCalledWith("Extracted resume text");
    expect(repository.upsertProfile).toHaveBeenNthCalledWith(1, "user-1", sampleResume.id, {
      status: "processing",
      errorMessage: null,
    });
    expect(repository.upsertProfile).toHaveBeenNthCalledWith(2, "user-1", sampleResume.id, {
      status: "completed",
      errorMessage: null,
      rawText: "Extracted resume text",
      parsed: sampleParsedResume,
    });
    expect(state.status).toBe("ready");
  });

  it("marks the profile failed and rethrows a typed error", async () => {
    const { repository, storage, extractors, service } = createService();
    vi.mocked(repository.findByIdForUser).mockResolvedValue(sampleResume);
    vi.mocked(storage.download).mockResolvedValue({
      bytes: new Uint8Array([1]),
      size: 4096,
      contentType: PDF_MIME_TYPE,
    });
    vi.mocked(extractors.extract).mockRejectedValue(new ExtractionError());
    vi.mocked(repository.upsertProfile).mockImplementation(
      async (_userId, _resumeId, input) =>
        makeProfile({
          status: input.status,
          errorMessage: input.errorMessage ?? null,
          parsed: null,
        }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.parse("user-1", sampleResume.id)).rejects.toBeInstanceOf(
      ExtractionError,
    );

    const failureCall = vi
      .mocked(repository.upsertProfile)
      .mock.calls.find(([, , input]) => input.status === "failed");
    expect(failureCall?.[2].errorMessage).toContain("couldn't read any text");
    expect(consoleError).toHaveBeenCalled();
  });

  it("rejects a resume that does not belong to the user", async () => {
    const { repository, storage, service } = createService();
    vi.mocked(repository.findByIdForUser).mockResolvedValue(null);

    await expect(service.parse("user-1", "other-resume")).rejects.toMatchObject({
      code: "resume_not_found",
    });
    expect(storage.download).not.toHaveBeenCalled();
  });

  it("is idempotent: re-parsing updates the same row and never inserts", async () => {
    const { repository, service } = arrangeSuccessfulParse();

    await service.parse("user-1", sampleResume.id);
    await service.parse("user-1", sampleResume.id);

    expect(repository.insert).not.toHaveBeenCalled();
    expect(repository.upsertProfile).toHaveBeenCalledTimes(4);
    expect(
      vi.mocked(repository.upsertProfile).mock.calls.every(
        ([, resumeId]) => resumeId === sampleResume.id,
      ),
    ).toBe(true);
  });

  it("wraps unknown failures as ParsingError and still records the failure", async () => {
    const { repository, storage, extractors } = createService();
    vi.mocked(repository.findByIdForUser).mockResolvedValue(sampleResume);
    vi.mocked(storage.download).mockResolvedValue({
      bytes: new Uint8Array([1]),
      size: 4096,
      contentType: PDF_MIME_TYPE,
    });
    vi.mocked(extractors.extract).mockResolvedValue("Extracted text");
    vi.mocked(repository.upsertProfile).mockImplementation(async () => makeProfile());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const parserProvider = vi.fn(() => {
      throw new Error("provider exploded");
    });
    const failingService = new ResumeService(
      repository,
      storage,
      parserProvider,
      extractors,
    );

    await expect(
      failingService.parse("user-1", sampleResume.id),
    ).rejects.toBeInstanceOf(ParsingError);
    expect(repository.upsertProfile).toHaveBeenCalledWith(
      "user-1",
      sampleResume.id,
      expect.objectContaining({ status: "failed" }),
    );
  });
});

describe("buildResumeInfo through the service", () => {
  it("reports failed states with the stored message", async () => {
    const { repository, service } = createService();
    vi.mocked(repository.findLatestByUserId).mockResolvedValue(sampleResume);
    vi.mocked(repository.findProfileByResumeId).mockResolvedValue(
      makeProfile({ status: "failed", errorMessage: "Scanned PDF", parsed: null }),
    );

    const state: ResumeInfo = await service.getState("user-1");

    expect(state.status).toBe("failed");
    expect(state.errorMessage).toBe("Scanned PDF");
    expect(state.highlights).toBeNull();
  });
});
