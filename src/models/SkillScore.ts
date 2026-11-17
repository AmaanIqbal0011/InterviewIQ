export interface SkillScoreProps {
  readonly label: string;
  /** Score from 0 to 100. */
  readonly value: number;
}

/** A scored skill dimension in the performance report. */
export class SkillScore {
  readonly label: string;
  readonly value: number;

  constructor(props: SkillScoreProps) {
    this.label = props.label;
    this.value = props.value;
  }
}
