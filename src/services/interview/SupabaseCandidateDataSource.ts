import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ParsedResume } from "@/lib/validation/resumeSchemas";
import { OnboardingService } from "@/services/OnboardingService";
import { ResumeRepository } from "@/repositories/ResumeRepository";
import type { CandidateDataSource } from "./CandidateContextBuilder";

/**
 * Production `CandidateDataSource`: onboarding answers from OnboardingService
 * and the latest parsed resume from ResumeRepository (both RLS-scoped).
 */
export class SupabaseCandidateDataSource implements CandidateDataSource {
  private readonly onboarding: OnboardingService;
  private readonly resumes: ResumeRepository;

  constructor(supabase: SupabaseClient<Database>) {
    this.onboarding = new OnboardingService(supabase);
    this.resumes = new ResumeRepository(supabase);
  }

  async loadOnboarding(userId: string) {
    return this.onboarding.getProgress(userId);
  }

  async loadCompletedResume(userId: string): Promise<ParsedResume | null> {
    const resume = await this.resumes.findLatestByUserId(userId);
    if (!resume) return null;

    const profile = await this.resumes.findProfileByResumeId(userId, resume.id);
    if (!profile || profile.status !== "completed" || !profile.parsed) return null;
    return profile.parsed;
  }
}
