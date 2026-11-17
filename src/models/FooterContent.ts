import type { FooterColumn } from "@/models/FooterColumn";
import type { SocialLink } from "@/models/SocialLink";

export interface FooterContentProps {
  readonly tagline: string;
  readonly columns: readonly FooterColumn[];
  readonly socials: readonly SocialLink[];
  readonly copyright: string;
  readonly closingNote: string;
}

/** Content for the site footer. */
export class FooterContent {
  readonly tagline: string;
  readonly columns: readonly FooterColumn[];
  readonly socials: readonly SocialLink[];
  readonly copyright: string;
  readonly closingNote: string;

  constructor(props: FooterContentProps) {
    this.tagline = props.tagline;
    this.columns = props.columns;
    this.socials = props.socials;
    this.copyright = props.copyright;
    this.closingNote = props.closingNote;
  }
}
