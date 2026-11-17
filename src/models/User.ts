export interface UserProps {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
}

/** The authenticated account as the application sees it. */
export class User {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.fullName = props.fullName;
  }

  /** Name to greet the user with — falls back to the email local part. */
  get displayName(): string {
    const trimmed = this.fullName.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
    const [localPart] = this.email.split("@");
    return localPart.length > 0 ? localPart : this.email;
  }
}
