export interface FaqProps {
  readonly question: string;
  readonly answer: string;
}

/** One frequently asked question and its answer. */
export class Faq {
  readonly question: string;
  readonly answer: string;

  constructor(props: FaqProps) {
    this.question = props.question;
    this.answer = props.answer;
  }
}
