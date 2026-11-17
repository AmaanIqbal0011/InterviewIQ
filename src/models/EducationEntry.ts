export const educationLevels = ["high_school", "diploma", "bachelors", "masters", "phd", "other"] as const;
export type EducationLevel = (typeof educationLevels)[number];

export interface EducationEntryProps {
  id: string;
  user_id: string;
  level: EducationLevel;
  institution: string;
  field_of_study: string | null;
  start_year: number;
  end_year: number | null;
  is_current: boolean;
  grade: string | null;
  created_at: string;
  updated_at: string;
}

export class EducationEntry {
  readonly id: string;
  readonly userId: string;
  readonly level: EducationLevel;
  readonly institution: string;
  readonly fieldOfStudy: string | null;
  readonly startYear: number;
  readonly endYear: number | null;
  readonly isCurrent: boolean;
  readonly grade: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: EducationEntryProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.level = props.level;
    this.institution = props.institution;
    this.fieldOfStudy = props.field_of_study;
    this.startYear = props.start_year;
    this.endYear = props.end_year;
    this.isCurrent = props.is_current;
    this.grade = props.grade;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;
  }
}
