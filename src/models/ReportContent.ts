import type { Action } from "@/models/Action";
import type { SkillScore } from "@/models/SkillScore";

export interface ReportContentProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly roleLabel: string;
  readonly dateLabel: string;
  readonly overallLabel: string;
  readonly overallScore: number;
  readonly summary: string;
  readonly skillsLabel: string;
  readonly strengthsLabel: string;
  readonly improvementsLabel: string;
  readonly skills: readonly SkillScore[];
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
  readonly cta: Action;
}

/** Content for the mock performance report preview. */
export class ReportContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly roleLabel: string;
  readonly dateLabel: string;
  readonly overallLabel: string;
  readonly overallScore: number;
  readonly summary: string;
  readonly skillsLabel: string;
  readonly strengthsLabel: string;
  readonly improvementsLabel: string;
  readonly skills: readonly SkillScore[];
  readonly strengths: readonly string[];
  readonly improvements: readonly string[];
  readonly cta: Action;

  constructor(props: ReportContentProps) {
    this.eyebrow = props.eyebrow;
    this.title = props.title;
    this.description = props.description;
    this.roleLabel = props.roleLabel;
    this.dateLabel = props.dateLabel;
    this.overallLabel = props.overallLabel;
    this.overallScore = props.overallScore;
    this.summary = props.summary;
    this.skillsLabel = props.skillsLabel;
    this.strengthsLabel = props.strengthsLabel;
    this.improvementsLabel = props.improvementsLabel;
    this.skills = props.skills;
    this.strengths = props.strengths;
    this.improvements = props.improvements;
    this.cta = props.cta;
  }
}
