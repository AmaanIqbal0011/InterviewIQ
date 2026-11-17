import type { SupabaseClient } from "@supabase/supabase-js";
import { InterviewRepository } from "@/repositories/InterviewRepository";
import type { Database } from "@/types/database";
import { CandidateContextBuilder } from "./CandidateContextBuilder";
import { InterviewService } from "./InterviewService";
import { SupabaseCandidateDataSource } from "./SupabaseCandidateDataSource";

/**
 * Server composition root for interview work. Actions and route handlers call
 * this, then only speak to `InterviewService`.
 */
export function createInterviewService(
  supabase: SupabaseClient<Database>,
): InterviewService {
  const repository = new InterviewRepository(supabase);
  const contextBuilder = new CandidateContextBuilder(
    new SupabaseCandidateDataSource(supabase),
  );
  return new InterviewService(repository, contextBuilder);
}
