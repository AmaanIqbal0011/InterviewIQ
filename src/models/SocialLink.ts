import type { IconKey } from "@/lib/icons";

export interface SocialLinkProps {
  readonly label: string;
  readonly href: string;
  readonly icon: IconKey;
}

/** A social profile link in the footer. */
export class SocialLink {
  readonly label: string;
  readonly href: string;
  readonly icon: IconKey;

  constructor(props: SocialLinkProps) {
    this.label = props.label;
    this.href = props.href;
    this.icon = props.icon;
  }
}
