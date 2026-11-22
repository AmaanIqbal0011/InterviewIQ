import type { Action } from "@/models/Action";
import type { ConversationMessage } from "@/models/ConversationMessage";

export interface ShowcaseContentProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly panelTitle: string;
  readonly panelSubtitle: string;
  readonly liveLabel: string;
  readonly messages: readonly ConversationMessage[];
  readonly footerNote: string;
  readonly cta: Action;
}

/** Content for the live interview showcase section. */
export class ShowcaseContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly panelTitle: string;
  readonly panelSubtitle: string;
  readonly liveLabel: string;
  readonly messages: readonly ConversationMessage[];
  readonly footerNote: string;
  readonly cta: Action;

  constructor(props: ShowcaseContentProps) {
    this.eyebrow = props.eyebrow;
    this.title = props.title;
    this.description = props.description;
    this.bullets = props.bullets;
    this.panelTitle = props.panelTitle;
    this.panelSubtitle = props.panelSubtitle;
    this.liveLabel = props.liveLabel;
    this.messages = props.messages;
    this.footerNote = props.footerNote;
    this.cta = props.cta;
  }
}
