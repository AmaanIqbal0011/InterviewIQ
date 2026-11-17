export interface SignUpPayloadProps {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly acceptedTerms: boolean;
}

/**
 * Validated signup input handed to `AuthService`. Consent is carried on the
 * payload so the service can refuse before any network call happens.
 */
export class SignUpPayload {
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly acceptedTerms: boolean;

  constructor(props: SignUpPayloadProps) {
    this.fullName = props.fullName;
    this.email = props.email;
    this.password = props.password;
    this.acceptedTerms = props.acceptedTerms;
  }
}
