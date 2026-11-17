export interface SignInPayloadProps {
  readonly email: string;
  readonly password: string;
}

/** Validated login input handed to `AuthService`. */
export class SignInPayload {
  readonly email: string;
  readonly password: string;

  constructor(props: SignInPayloadProps) {
    this.email = props.email;
    this.password = props.password;
  }
}
