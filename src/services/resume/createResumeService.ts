import type { SupabaseClient } from "@supabase/supabase-js";
import { ResumeRepository } from "@/repositories/ResumeRepository";
import { ResumeParser } from "./ResumeParser";
import { ResumeService } from "./ResumeService";
import { ResumeStorageService } from "./ResumeStorageService";
import { TextExtractorFactory } from "./TextExtractor";
import { createLLMClientFromEnv, getLLMTimeoutMs } from "./llm/createLLMClient";
import type { Database } from "@/types/database";

/**
 * Server composition root for resume work. Route handlers and server actions
 * call this, then only speak to ResumeService.
 */
export function createResumeService(supabase: SupabaseClient<Database>): ResumeService {
  return new ResumeService(
    new ResumeRepository(supabase),
    new ResumeStorageService(supabase),
    () => new ResumeParser(createLLMClientFromEnv(), { timeoutMs: getLLMTimeoutMs() }),
    new TextExtractorFactory(),
  );
}
