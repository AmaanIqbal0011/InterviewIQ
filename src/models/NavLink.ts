export interface NavLinkProps {
  readonly label: string;
  readonly href: string;
}

/** A navigation entry — anchor link or route. */
export class NavLink {
  readonly label: string;
  readonly href: string;

  constructor(props: NavLinkProps) {
    this.label = props.label;
    this.href = props.href;
  }
}
