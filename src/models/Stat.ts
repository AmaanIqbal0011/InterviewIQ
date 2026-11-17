export interface StatProps {
  readonly value: string;
  readonly label: string;
}

/** A trust statistic shown in the social proof strip. */
export class Stat {
  readonly value: string;
  readonly label: string;

  constructor(props: StatProps) {
    this.value = props.value;
    this.label = props.label;
  }
}
