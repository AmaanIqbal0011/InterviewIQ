import { validateResumeFile, inferResumeMimeType, isAcceptedResumeMimeType } from "@/lib/resume/constants";
import type { ResumeInfo } from "@/models/ResumeInfo";
import { registerResumeAction } from "@/app/(protected)/dashboard/resume-actions";
import { ResumeApiClient, ResumeClientError } from "./ResumeApiClient";
import type { IResumeStorageService } from "./ResumeStorageService";

/**
 * Browser-side orchestration: validate -> upload with progress -> register ->
 * trigger parsing. The card only calls this class and renders its state.
 */
export class ResumeClientService {
  private readonly storage: IResumeStorageService;
  private readonly api: ResumeApiClient;

  constructor(storage: IResumeStorageService, api: ResumeApiClient) {
    this.storage = storage;
    this.api = api;
  }

  async upload(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<ResumeInfo> {
    const validation = validateResumeFile(file);
    if (validation) throw new ResumeClientError(validation.message);

    const mimeType = isAcceptedResumeMimeType(file.type)
      ? file.type
      : inferResumeMimeType(file.name);

    if (!mimeType) {
      throw new ResumeClientError(
        "That file type isn't supported. Upload a PDF or DOCX file.",
      );
    }

    const uploaded = await this.storage.upload(file, { mimeType, onProgress });

    const result = await registerResumeAction({
      filePath: uploaded.path,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    });

    if (!result.ok) {
      // The record was never saved, so the object would otherwise be orphaned.
      await this.storage.delete(uploaded.path).catch(() => undefined);
      throw new ResumeClientError(result.message);
    }

    return result.resume;
  }

  async parse(resumeId: string): Promise<ResumeInfo> {
    return this.api.parse(resumeId);
  }

  async getStatus(): Promise<ResumeInfo> {
    return this.api.getStatus();
  }
}
