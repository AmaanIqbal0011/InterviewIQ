export interface BrandConfig {
  /** Placeholder brand name — rename here to rebrand the whole site. */
  readonly name: string;
  readonly tagline: string;
}

export interface SiteRoutes {
  readonly login: string;
  readonly signup: string;
  readonly forgotPassword: string;
  readonly dashboard: string;
  readonly onboarding: string;
  readonly newInterview: string;
  readonly interviews: string;
  readonly resume: string;
}

export interface SiteConfig {
  readonly brand: BrandConfig;
  /** Canonical site URL, used for metadata and Open Graph. */
  readonly url: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly routes: SiteRoutes;
}

/**
 * Version of the legal copy a user accepts at signup. Bump this whenever the
 * Terms & Conditions or Privacy Policy change materially — it is stored on
 * every account so you can tell who agreed to what.
 */
export const TERMS_VERSION = "1.0.0";

export const siteConfig: SiteConfig = {
  brand: {
    name: "InterviewIQ",
    tagline: "Your AI interview coach",
  },
  url: "https://interviewiq.example.com",
  description:
    "Upload your resume and practice with a live AI interviewer. Finish every session with a detailed performance report — scores, strengths, weak areas and improvement tips.",
  keywords: [
    "AI interview coach",
    "mock interview",
    "interview practice",
    "AI interviewer",
    "resume interview",
    "interview preparation",
  ],
  routes: {
    login: "/login",
    signup: "/signup",
    forgotPassword: "/forgot-password",
    dashboard: "/dashboard",
    onboarding: "/onboarding",
    newInterview: "/interview/new",
    interviews: "/interview",
    resume: "/resume",
  },
};
