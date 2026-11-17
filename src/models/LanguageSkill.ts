export const languageProficiencies = ["basic", "conversational", "fluent", "native"] as const;
export type Proficiency = (typeof languageProficiencies)[number];

export interface LanguageSkillProps {
  id: string;
  user_id: string;
  language: string;
  proficiency: Proficiency;
  is_interview_language: boolean;
  created_at: string;
  updated_at: string;
}

export class LanguageSkill {
  readonly id: string;
  readonly userId: string;
  readonly language: string;
  readonly proficiency: Proficiency;
  readonly isInterviewLanguage: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: LanguageSkillProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.language = props.language;
    this.proficiency = props.proficiency;
    this.isInterviewLanguage = props.is_interview_language;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;
  }
}
