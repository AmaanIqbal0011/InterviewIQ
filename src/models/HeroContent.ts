import type { Action } from "@/models/Action";

export interface HeroMockupProps {
  readonly interviewerName: string;
  readonly interviewerRole: string;
  readonly statusLabel: string;
  readonly questionLabel: string;
  readonly question: string;
  readonly contextChip: string;
  readonly roundChip: string;
  readonly questionProgress: string;
  readonly listeningLabel: string;
  readonly syncedNote: string;
  readonly latencyChip: string;
  readonly startSeconds: number;
}

/** Content for the animated "live interview" card in the hero. */
export class HeroMockup {
  readonly interviewerName: string;
  readonly interviewerRole: string;
  readonly statusLabel: string;
  readonly questionLabel: string;
  readonly question: string;
  readonly contextChip: string;
  readonly roundChip: string;
  readonly questionProgress: string;
  readonly listeningLabel: string;
  readonly syncedNote: string;
  readonly latencyChip: string;
  readonly startSeconds: number;

  constructor(props: HeroMockupProps) {
    this.interviewerName = props.interviewerName;
    this.interviewerRole = props.interviewerRole;
    this.statusLabel = props.statusLabel;
    this.questionLabel = props.questionLabel;
    this.question = props.question;
    this.contextChip = props.contextChip;
    this.roundChip = props.roundChip;
    this.questionProgress = props.questionProgress;
    this.listeningLabel = props.listeningLabel;
    this.syncedNote = props.syncedNote;
    this.latencyChip = props.latencyChip;
    this.startSeconds = props.startSeconds;
  }
}

export interface HeroContentProps {
  readonly badge: string;
  readonly headline: string;
  readonly headlineHighlight: string;
  readonly subheadline: string;
  readonly primaryAction: Action;
  readonly secondaryAction: Action;
  readonly trustNote: string;
  readonly mockup: HeroMockup;
}

/** Above-the-fold hero content. */
export class HeroContent {
  readonly badge: string;
  readonly headline: string;
  readonly headlineHighlight: string;
  readonly subheadline: string;
  readonly primaryAction: Action;
  readonly secondaryAction: Action;
  readonly trustNote: string;
  readonly mockup: HeroMockup;

  constructor(props: HeroContentProps) {
    this.badge = props.badge;
    this.headline = props.headline;
    this.headlineHighlight = props.headlineHighlight;
    this.subheadline = props.subheadline;
    this.primaryAction = props.primaryAction;
    this.secondaryAction = props.secondaryAction;
    this.trustNote = props.trustNote;
    this.mockup = props.mockup;
  }
}
