import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError } from "@/lib/errors/AppError";
import {
  aboutYouSchema,
  careerTargetStepSchema,
  educationStepSchema,
  interviewSetupStepSchema,
} from "@/lib/validation/onboardingSchemas";
import type { CareerGoal } from "@/models/CareerGoal";
import type { EducationEntry } from "@/models/EducationEntry";
import type { LanguageSkill } from "@/models/LanguageSkill";
import type { Profile } from "@/models/Profile";
import type { Skill } from "@/models/Skill";
import type { WorkExperience } from "@/models/WorkExperience";
import { CareerGoalRepository } from "@/repositories/CareerGoalRepository";
import { EducationRepository } from "@/repositories/EducationRepository";
import { LanguageRepository } from "@/repositories/LanguageRepository";
import { ProfileRepository } from "@/repositories/ProfileRepository";
import { SkillRepository } from "@/repositories/SkillRepository";
import { WorkExperienceRepository } from "@/repositories/WorkExperienceRepository";

export interface OnboardingProgress {
  profile: Profile;
  education: EducationEntry[];
  workExperiences: WorkExperience[];
  languages: LanguageSkill[];
  skills: Skill[];
  careerGoal: CareerGoal | null;
}

export class OnboardingService {
  private readonly profileRepository: ProfileRepository;
  private readonly educationRepository: EducationRepository;
  private readonly workExperienceRepository: WorkExperienceRepository;
  private readonly languageRepository: LanguageRepository;
  private readonly skillRepository: SkillRepository;
  private readonly careerGoalRepository: CareerGoalRepository;

  constructor(supabase: SupabaseClient<Database>) {
    this.profileRepository = new ProfileRepository(supabase);
    this.educationRepository = new EducationRepository(supabase);
    this.workExperienceRepository = new WorkExperienceRepository(supabase);
    this.languageRepository = new LanguageRepository(supabase);
    this.skillRepository = new SkillRepository(supabase);
    this.careerGoalRepository = new CareerGoalRepository(supabase);
  }

  async getProgress(userId: string): Promise<OnboardingProgress> {
    const [profile, education, workExperiences, languages, skills, careerGoal] = await Promise.all([
      this.profileRepository.getByUserId(userId),
      this.educationRepository.listByUserId(userId),
      this.workExperienceRepository.listByUserId(userId),
      this.languageRepository.listByUserId(userId),
      this.skillRepository.listByUserId(userId),
      this.careerGoalRepository.getByUserId(userId),
    ]);
    return { profile, education, workExperiences, languages, skills, careerGoal };
  }

  async getFullProfile(userId: string): Promise<OnboardingProgress> {
    return this.getProgress(userId);
  }

  async saveStep(userId: string, stepNumber: number, data: unknown): Promise<Profile> {
    let nextStep = stepNumber + 1;
    switch (stepNumber) {
      case 1: {
        const parsed = aboutYouSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        await this.profileRepository.updateAboutYou(userId, parsed.data);
        break;
      }
      case 2: {
        const parsed = educationStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        this.assertUniqueIds(parsed.data.education);
        await this.educationRepository.replaceForUser(userId, parsed.data.education);
        break;
      }
      case 3: {
        const parsed = careerTargetStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        const existing = await this.careerGoalRepository.getByUserId(userId);
        const targetCompanies = this.dedupeStrings(parsed.data.career_goal.target_companies);
        const topSkills = this.dedupeStrings(parsed.data.top_skills).slice(0, 10);
        await this.skillRepository.replaceForUser(
          userId,
          topSkills.map((name) => ({
            name,
            category: "technical",
            level: "intermediate",
          })),
        );
        await this.careerGoalRepository.upsert(userId, {
          target_role: parsed.data.career_goal.target_role,
          target_industry: parsed.data.career_goal.target_industry,
          experience_level: parsed.data.career_goal.experience_level,
          target_companies: targetCompanies,
          interview_type: existing?.interviewType ?? "mixed",
          difficulty: existing?.difficulty ?? "medium",
          interview_language: existing?.interviewLanguage || "English",
          practice_goals: existing?.practiceGoals ?? [],
          additional_notes: existing?.additionalNotes ?? null,
        });
        break;
      }
      case 4: {
        const parsed = interviewSetupStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        const existing = await this.careerGoalRepository.getByUserId(userId);
        await this.languageRepository.replaceForUser(userId, [{
          language: parsed.data.career_goal.interview_language,
          proficiency: parsed.data.interview_language_proficiency,
          is_interview_language: true,
        }]);
        await this.careerGoalRepository.upsert(userId, {
          target_role: existing?.targetRole ?? "Not specified",
          target_industry: existing?.targetIndustry ?? null,
          experience_level: existing?.experienceLevel ?? "entry",
          target_companies: existing?.targetCompanies ?? [],
          interview_type: parsed.data.career_goal.interview_type,
          difficulty: parsed.data.career_goal.difficulty,
          interview_language: parsed.data.career_goal.interview_language,
          practice_goals: parsed.data.career_goal.practice_goals,
          additional_notes: parsed.data.career_goal.additional_notes,
        });
        nextStep = 4;
        break;
      }
      default:
        throw new AppError("invalid_input");
    }

    return this.profileRepository.updateProgress(userId, nextStep);
  }

  async completeOnboarding(userId: string): Promise<Profile> {
    const progress = await this.getProgress(userId);
    if (
      !progress.profile.fullName.trim() ||
      !progress.profile.currentStatus ||
      progress.education.length !== 1 ||
      progress.languages.filter((language) => language.isInterviewLanguage).length !== 1 ||
      !progress.careerGoal ||
      progress.careerGoal.practiceGoals.length < 1 ||
      progress.careerGoal.practiceGoals.length > 3 ||
      progress.languages.find((language) => language.isInterviewLanguage)?.language !==
        progress.careerGoal.interviewLanguage
    ) {
      throw new AppError("invalid_input");
    }
    return this.profileRepository.complete(userId);
  }

  private assertUniqueIds(items: ReadonlyArray<{ id?: string }>): void {
    const ids = items.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(ids).size !== ids.length) {
      throw new AppError("invalid_input");
    }
  }

  private dedupeStrings(items: readonly string[]): string[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
