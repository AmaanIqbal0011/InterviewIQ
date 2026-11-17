export interface ActionProps {
  readonly label: string;
  readonly href: string;
}

/** A call-to-action button's label and destination. */
export class Action {
  readonly label: string;
  readonly href: string;

  constructor(props: ActionProps) {
    this.label = props.label;
    this.href = props.href;
  }
}
