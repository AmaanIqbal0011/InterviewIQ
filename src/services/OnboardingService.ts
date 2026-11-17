import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError } from "@/lib/errors/AppError";
import {
  aboutYouSchema,
  careerGoalsStepSchema,
  educationStepSchema,
  languagesStepSchema,
  skillsStepSchema,
  workExperienceStepSchema,
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
        const parsed = workExperienceStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        this.assertUniqueIds(parsed.data.work_experiences);
        await this.workExperienceRepository.replaceForUser(
          userId,
          parsed.data.work_experiences,
        );
        break;
      }
      case 4: {
        const parsed = skillsStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        this.assertUniqueIds(parsed.data.skills);
        await this.skillRepository.replaceForUser(userId, parsed.data.skills);
        break;
      }
      case 5: {
        const parsed = languagesStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        this.assertUniqueIds(parsed.data.languages);
        await this.languageRepository.replaceForUser(userId, parsed.data.languages);
        break;
      }
      case 6: {
        const parsed = careerGoalsStepSchema.safeParse(data);
        if (!parsed.success) throw new AppError("invalid_input", { cause: parsed.error });
        const selectedLanguages = (await this.languageRepository.listByUserId(userId))
          .filter((language) => language.isInterviewLanguage);
        if (
          selectedLanguages.length !== 1 ||
          selectedLanguages[0].language !== parsed.data.career_goal.interview_language
        ) {
          throw new AppError("invalid_input");
        }
        await this.careerGoalRepository.upsert(userId, parsed.data.career_goal);
        nextStep = 7;
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
      !progress.profile.country ||
      !progress.profile.city ||
      !progress.profile.currentStatus ||
      progress.education.length === 0 ||
      progress.skills.length < 3 ||
      progress.languages.filter((language) => language.isInterviewLanguage).length !== 1 ||
      !progress.careerGoal ||
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
}
