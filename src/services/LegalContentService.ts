import { TERMS_VERSION, siteConfig } from "@/lib/siteConfig";

/** Which legal document to show. */
export type LegalDocumentKey = "terms" | "privacy";

/**
 * Single source of truth for the long-form legal copy rendered inside the
 * auth modal. Text is kept as `\n\n`-joined paragraphs so it flows naturally
 * inside a scrollable, readable column.
 */
export class LegalContentService {
  private static instance: LegalContentService | null = null;

  private readonly terms: string;
  private readonly privacy: string;

  private constructor() {
    const { brand } = siteConfig;

    this.terms = [
      `Terms & Conditions — version ${TERMS_VERSION}`,
      `Last updated: ${TERMS_VERSION}. These Terms & Conditions govern your use of ${brand.name} (${brand.tagline}). By creating an account you confirm that you have read and accepted them.`,
      `1. The service. ${brand.name} lets you upload a resume, take practice interviews with an AI interviewer and receive performance reports. Features may change as the product evolves.`,
      `2. Your account. You are responsible for keeping your credentials confidential and for all activity that happens under your account. Provide accurate information and tell us promptly if you believe your account has been compromised.`,
      `3. Acceptable use. You agree not to misuse the service, including attempting to interfere with its operation, reverse engineering it, uploading content you do not have the right to share, or using ${brand.name} for any unlawful purpose.`,
      `4. Your content. You retain ownership of the resume, answers and other material you submit. You grant ${brand.name} a limited licence to process that content in order to run interviews and produce reports for you.`,
      `5. Intellectual property. ${brand.name}, including its branding, interface and software, remains the property of its owners. No rights are granted except the limited right to use the service as described here.`,
      `6. No guarantee of outcomes. Practice interviews and reports are provided for preparation only. We do not guarantee that using ${brand.name} will result in any particular interview outcome, offer or employment.`,
      `7. Disclaimers and liability. To the fullest extent permitted by law, the service is provided "as is" without warranties of any kind, and ${brand.name} is not liable for indirect, incidental or consequential damages arising from your use of it.`,
      `8. Changes to these terms. We may update these terms from time to time. When we do, we bump the version number stored with your account and ask you to accept the new terms the next time you sign up.`,
      `9. Contact. Questions about these terms can be sent to the ${brand.name} team from the contact details published on our website.`,
    ].join("\n\n");

    this.privacy = [
      `Privacy Policy — version ${TERMS_VERSION}`,
      `This policy explains what ${brand.name} collects, why we collect it and the choices you have. It applies to the website and to your account.`,
      `1. Information we collect. We collect the details you provide when signing up — your name, email address and password — plus the resume content, interview answers and reports you generate while using the product.`,
      `2. How we use it. We use this information to provide the service: to authenticate you, tailor interview questions to your experience, produce your performance reports and keep your account secure.`,
      `3. What we do not do. We do not sell your personal information. We do not use the content of your interviews to train third-party models, and we do not share your resume with other users.`,
      `4. Service providers. Data is hosted and processed by infrastructure providers such as our authentication and database host, who process it only on our behalf and under appropriate contractual safeguards.`,
      `5. Retention. We keep account information for as long as your account exists. You can ask us to delete your account and its associated content at any time.`,
      `6. Your rights. Depending on where you live, you may have the right to access, correct, export or erase your personal data. Reach out to us and we will act on verified requests.`,
      `7. Security. We use industry-standard measures to protect your data, including encrypted transport and hashed credentials. No system is perfectly secure, so please use a strong, unique password.`,
      `8. Changes. We may update this policy as the product changes. Material changes bump the version number stored with your account and are brought to your attention the next time you sign up.`,
      `9. Contact. For privacy questions, contact the ${brand.name} team using the details published on our website.`,
    ].join("\n\n");
  }

  static getInstance(): LegalContentService {
    if (!LegalContentService.instance) {
      LegalContentService.instance = new LegalContentService();
    }
    return LegalContentService.instance;
  }

  getTerms(): string {
    return this.terms;
  }

  getPrivacy(): string {
    return this.privacy;
  }

  getDocument(kind: LegalDocumentKey): string {
    return kind === "terms" ? this.terms : this.privacy;
  }

  getTitle(kind: LegalDocumentKey): string {
    return kind === "terms" ? "Terms & Conditions" : "Privacy Policy";
  }
}

export const legalContentService = LegalContentService.getInstance();
