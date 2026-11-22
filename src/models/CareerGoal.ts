export const experienceLevels = ["entry", "junior", "mid", "senior"] as const;
export type ExperienceLevel = (typeof experienceLevels)[number];
export const interviewTypes = ["technical", "behavioral", "mixed", "hr"] as const;
export type InterviewType = (typeof interviewTypes)[number];
export const interviewDifficulties = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof interviewDifficulties)[number];
export const practiceGoals = [
  "confidence",
  "communication",
  "technical_answers",
  "behavioral_answers",
  "english_fluency",
  "time_management",
] as const;
export type PracticeGoal = (typeof practiceGoals)[number];

export interface CareerGoalProps {
  user_id: string;
  target_role: string;
  target_industry: string | null;
  experience_level: ExperienceLevel;
  target_companies: string[];
  interview_type: InterviewType;
  difficulty: Difficulty;
  interview_language: string;
  practice_goals: PracticeGoal[];
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
}

export class CareerGoal {
  readonly userId: string;
  readonly targetRole: string;
  readonly targetIndustry: string | null;
  readonly experienceLevel: ExperienceLevel;
  readonly targetCompanies: string[];
  readonly interviewType: InterviewType;
  readonly difficulty: Difficulty;
  readonly interviewLanguage: string;
  readonly practiceGoals: PracticeGoal[];
  readonly additionalNotes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: CareerGoalProps) {
    this.userId = props.user_id;
    this.targetRole = props.target_role;
    this.targetIndustry = props.target_industry;
    this.experienceLevel = props.experience_level;
    this.targetCompanies = props.target_companies;
    this.interviewType = props.interview_type;
    this.difficulty = props.difficulty;
    this.interviewLanguage = props.interview_language;
    this.practiceGoals = props.practice_goals;
    this.additionalNotes = props.additional_notes;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;
  }
}
