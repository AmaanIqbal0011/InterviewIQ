import type { NavLink } from "@/models/NavLink";

export interface FooterColumnProps {
  readonly title: string;
  readonly links: readonly NavLink[];
}

/** One grouped column of footer links. */
export class FooterColumn {
  readonly title: string;
  readonly links: readonly NavLink[];

  constructor(props: FooterColumnProps) {
    this.title = props.title;
    this.links = props.links;
  }
}
