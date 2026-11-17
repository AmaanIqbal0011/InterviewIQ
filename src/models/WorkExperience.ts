export const employmentTypes = ["full_time", "part_time", "contract", "internship", "other"] as const;
export type EmploymentType = (typeof employmentTypes)[number];

export interface WorkExperienceProps {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  employment_type: EmploymentType;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export class WorkExperience {
  readonly id: string;
  readonly userId: string;
  readonly jobTitle: string;
  readonly company: string;
  readonly employmentType: EmploymentType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isCurrent: boolean;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: WorkExperienceProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.jobTitle = props.job_title;
    this.company = props.company;
    this.employmentType = props.employment_type;
    this.startDate = props.start_date;
    this.endDate = props.end_date;
    this.isCurrent = props.is_current;
    this.description = props.description;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;
  }
}
