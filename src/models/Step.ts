import type { IconKey } from "@/lib/icons";

export interface StepProps {
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly icon: IconKey;
}

/** One step of the "how it works" flow. */
export class Step {
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly icon: IconKey;

  constructor(props: StepProps) {
    this.index = props.index;
    this.title = props.title;
    this.description = props.description;
    this.icon = props.icon;
  }
}
