import type { Action } from "@/models/Action";

export interface CtaContentProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly titleHighlight: string;
  readonly description: string;
  readonly primaryAction: Action;
  readonly secondaryAction: Action;
  readonly note: string;
}

/** Content for the closing call-to-action banner. */
export class CtaContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly titleHighlight: string;
  readonly description: string;
  readonly primaryAction: Action;
  readonly secondaryAction: Action;
  readonly note: string;

  constructor(props: CtaContentProps) {
    this.eyebrow = props.eyebrow;
    this.title = props.title;
    this.titleHighlight = props.titleHighlight;
    this.description = props.description;
    this.primaryAction = props.primaryAction;
    this.secondaryAction = props.secondaryAction;
    this.note = props.note;
  }
}
