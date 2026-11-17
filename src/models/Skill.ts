export const skillCategories = ["technical", "soft", "tool"] as const;
export type SkillCategory = (typeof skillCategories)[number];
export const skillLevels = ["beginner", "intermediate", "advanced"] as const;
export type SkillLevel = (typeof skillLevels)[number];

export interface SkillProps {
  id: string;
  user_id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  created_at: string;
  updated_at: string;
}

export class Skill {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly category: SkillCategory;
  readonly level: SkillLevel;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: SkillProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.name = props.name;
    this.category = props.category;
    this.level = props.level;
    this.createdAt = props.created_at;
    this.updatedAt = props.updated_at;
  }
}
