export type ConversationRole = "interviewer" | "candidate";

export interface ConversationMessageProps {
  readonly role: ConversationRole;
  readonly text: string;
}

/** One turn in the mock conversation shown in the live interview showcase. */
export class ConversationMessage {
  readonly role: ConversationRole;
  readonly text: string;

  constructor(props: ConversationMessageProps) {
    this.role = props.role;
    this.text = props.text;
  }
}
