import type { IconKey } from "@/lib/icons";

export interface FeatureProps {
  readonly title: string;
  readonly description: string;
  readonly icon: IconKey;
  readonly badge?: string;
}

/** One product feature card. */
export class Feature {
  readonly title: string;
  readonly description: string;
  readonly icon: IconKey;
  readonly badge?: string;

  constructor(props: FeatureProps) {
    this.title = props.title;
    this.description = props.description;
    this.icon = props.icon;
    this.badge = props.badge;
  }
}
