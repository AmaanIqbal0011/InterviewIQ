import type { SupabaseClient } from "@supabase/supabase-js";
import { ResumeStorageError } from "@/lib/errors/ResumeError";
import { RESUME_BUCKET, type ResumeMimeType } from "@/lib/resume/constants";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export interface StorageObjectInfo {
  readonly size: number;
  readonly contentType: string | null;
}

export interface DownloadedResume {
  readonly bytes: Uint8Array;
  readonly size: number;
  readonly contentType: string | null;
}

export interface UploadResumeOptions {
  readonly mimeType: ResumeMimeType;
  readonly onProgress?: (percent: number) => void;
}

export interface UploadedResume {
  readonly path: string;
  readonly fileName: string;
  readonly mimeType: ResumeMimeType;
  readonly size: number;
}

export interface IResumeStorageService {
  upload(file: File, options: UploadResumeOptions): Promise<UploadedResume>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  download(path: string): Promise<DownloadedResume>;
  stat(path: string): Promise<StorageObjectInfo>;
}

/**
 * Thin wrapper around Supabase Storage. Browser uploads go through XHR so the
 * card can show real progress; server reads use the SDK, which respects the
 * storage RLS policies through the request's session.
 */
export class ResumeStorageService implements IResumeStorageService {
  private readonly client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  async upload(file: File, options: UploadResumeOptions): Promise<UploadedResume> {
    const {
      data: { user },
      error: userError,
    } = await this.client.auth.getUser();

    if (userError || !user) {
      throw new ResumeStorageError({
        message: "Your session expired. Please sign in again.",
      });
    }

    const path = `${user.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

    if (options.onProgress && typeof XMLHttpRequest !== "undefined") {
      await this.uploadWithProgress(path, file, options);
    } else {
      const { error } = await this.client.storage
        .from(RESUME_BUCKET)
        .upload(path, file, {
          contentType: options.mimeType,
          cacheControl: "3600",
          upsert: false,
        });
      if (error) throw new ResumeStorageError({ cause: error });
    }

    return {
      path,
      fileName: file.name,
      mimeType: options.mimeType,
      size: file.size,
    };
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage.from(RESUME_BUCKET).remove([path]);
    if (error) throw new ResumeStorageError({ cause: error });
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new ResumeStorageError({ cause: error });
    }
    return data.signedUrl;
  }

  async download(path: string): Promise<DownloadedResume> {
    const { data, error } = await this.client.storage.from(RESUME_BUCKET).download(path);
    if (error || !data) throw new ResumeStorageError({ cause: error });

    const bytes = new Uint8Array(await data.arrayBuffer());
    return {
      bytes,
      size: data.size || bytes.byteLength,
      contentType: data.type || null,
    };
  }

  async stat(path: string): Promise<StorageObjectInfo> {
    const { data, error } = await this.client.storage.from(RESUME_BUCKET).info(path);
    if (error || !data) throw new ResumeStorageError({ cause: error });

    return {
      size: data.size ?? 0,
      contentType: data.contentType ?? null,
    };
  }

  private async uploadWithProgress(
    path: string,
    file: File,
    options: UploadResumeOptions,
  ): Promise<void> {
    const {
      data: { session },
      error: sessionError,
    } = await this.client.auth.getSession();

    if (sessionError || !session) {
      throw new ResumeStorageError({
        message: "Your session expired. Please sign in again.",
      });
    }

    const { url, publishableKey } = getSupabaseConfig();
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const endpoint = `${url}/storage/v1/object/${RESUME_BUCKET}/${encodedPath}`;

    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", endpoint);
      request.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      request.setRequestHeader("apikey", publishableKey);
      request.setRequestHeader("Content-Type", options.mimeType);
      request.setRequestHeader("cache-control", "3600");
      request.setRequestHeader("x-upsert", "false");

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable || !options.onProgress) return;
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      };

      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          options.onProgress?.(100);
          resolve();
          return;
        }
        console.error("Resume upload failed", { status: request.status });
        reject(new ResumeStorageError());
      };

      request.onerror = () => {
        reject(new ResumeStorageError());
      };

      request.send(file);
    });
  }
}

/** Keeps storage keys predictable and safe while preserving the extension. */
export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._-]+/, "")
    .slice(-120);

  return cleaned || "resume";
}
