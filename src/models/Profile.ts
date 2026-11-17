export const currentStatuses = [
  "student",
  "working_professional",
  "fresher",
  "career_switcher",
  "other",
] as const;
export type CurrentStatus = (typeof currentStatuses)[number];

export interface ProfileProps {
  id: string;
  full_name: string;
  country: string | null;
  city: string | null;
  current_status: CurrentStatus | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export class Profile {
  readonly id: string;
  readonly fullName: string;
  readonly country: string | null;
  readonly city: string | null;
  readonly currentStatus: CurrentStatus | null;
  readonly onboardingCompleted: boolean;
  readonly onboardingStep: number;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: ProfileProps) {
    this.id = props.id;
    this.fullName = props.full_name;
    this.country = props.country;
    this.city = props.city;
    this.currentStatus = props.current_status;
    this.onboardingCompleted = props.onboarding_completed;
    this.onboardingStep = props.onboarding_step;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;
  }
}
