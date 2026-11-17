import { siteConfig } from "@/lib/siteConfig";
import { Action } from "@/models/Action";
import { CtaContent } from "@/models/CtaContent";
import { ConversationMessage } from "@/models/ConversationMessage";
import { Faq } from "@/models/Faq";
import { Feature } from "@/models/Feature";
import { FooterColumn } from "@/models/FooterColumn";
import { FooterContent } from "@/models/FooterContent";
import { HeroContent, HeroMockup } from "@/models/HeroContent";
import { NavLink } from "@/models/NavLink";
import { ReportContent } from "@/models/ReportContent";
import { ShowcaseContent } from "@/models/ShowcaseContent";
import { SkillScore } from "@/models/SkillScore";
import { SocialLink } from "@/models/SocialLink";
import { Stat } from "@/models/Stat";
import { Step } from "@/models/Step";

/**
 * Single source of truth for every piece of landing page content.
 * Components read from getter methods — no copy is hardcoded in JSX.
 */
export class LandingContentService {
  private static instance: LandingContentService | null = null;

  private readonly navLinks: readonly NavLink[];
  private readonly hero: HeroContent;
  private readonly stats: readonly Stat[];
  private readonly steps: readonly Step[];
  private readonly features: readonly Feature[];
  private readonly showcase: ShowcaseContent;
  private readonly report: ReportContent;
  private readonly faqs: readonly Faq[];
  private readonly cta: CtaContent;
  private readonly footer: FooterContent;

  private constructor() {
    const { routes, brand } = siteConfig;

    this.navLinks = [
      new NavLink({ label: "Features", href: "#features" }),
      new NavLink({ label: "How it works", href: "#how-it-works" }),
      new NavLink({ label: "Report", href: "#report" }),
      new NavLink({ label: "FAQ", href: "#faq" }),
    ];

    this.hero = new HeroContent({
      badge: "Live voice interviews, available 24/7",
      headline: "Practice the interview. Master the offer.",
      headlineHighlight: "Master the offer.",
      subheadline:
        "Upload your resume, choose your target role, and go head-to-head with a live AI avatar interviewer that asks questions tailored to your experience. Finish with a detailed report of scores, strengths, and exactly what to improve.",
      primaryAction: new Action({ label: "Start your free interview", href: routes.signup }),
      secondaryAction: new Action({ label: "See how it works", href: "#how-it-works" }),
      trustNote: "Free first interview · No credit card required",
      mockup: new HeroMockup({
        interviewerName: "Aria",
        interviewerRole: "AI Interviewer · Senior Frontend Engineer",
        statusLabel: "Live",
        questionLabel: "Question",
        question:
          "Walk me through a time you had to explain a risky technical tradeoff to a non-technical stakeholder. What did you say, and what happened?",
        contextChip: "Tailored from your resume",
        roundChip: "Behavioral round",
        questionProgress: "Question 4 of 12",
        listeningLabel: "Listening…",
        syncedNote: "Resume synced · 3 projects analyzed",
        latencyChip: "Voice latency · 240 ms",
        startSeconds: 754,
      }),
    });

    this.stats = [
      new Stat({ value: "250K+", label: "Interviews completed" }),
      new Stat({ value: "+34%", label: "Average score improvement" }),
      new Stat({ value: "50+", label: "Roles supported" }),
    ];

    this.steps = [
      new Step({
        index: 1,
        title: "Upload resume",
        description:
          "Drop in your resume and the AI instantly maps your experience, skills and projects.",
        icon: "upload",
      }),
      new Step({
        index: 2,
        title: "Choose role and level",
        description:
          "Pick the exact role and seniority you are interviewing for — from intern to staff.",
        icon: "briefcase",
      }),
      new Step({
        index: 3,
        title: "Live AI avatar interview",
        description:
          "Answer out loud to a lifelike AI interviewer that follows up, probes and adapts.",
        icon: "video",
      }),
      new Step({
        index: 4,
        title: "Get your report",
        description:
          "Receive an overall score, skill breakdown and a prioritized improvement plan in seconds.",
        icon: "clipboard",
      }),
    ];

    this.features = [
      new Feature({
        title: "Live AI avatar interviewer",
        description:
          "A natural face, tone and body language make the pressure — and the practice — feel real.",
        icon: "bot",
        badge: "Flagship",
      }),
      new Feature({
        title: "Resume-based tailored questions",
        description:
          "Every question is grounded in your actual experience, projects and the role you are chasing.",
        icon: "file-text",
      }),
      new Feature({
        title: "Real-time voice conversation",
        description:
          "Talk, interrupt, ask for clarification. Low-latency voice keeps the dialogue two-way.",
        icon: "mic",
      }),
      new Feature({
        title: "Instant AI feedback",
        description:
          "Get notes on pacing, filler words and answer structure the moment you finish speaking.",
        icon: "zap",
      }),
      new Feature({
        title: "Detailed performance report",
        description:
          "Overall score, skill bars, strengths, weak areas and next steps after every session.",
        icon: "chart",
      }),
      new Feature({
        title: "Role-specific and difficulty levels",
        description:
          "Behavioral, technical and case rounds across 50+ roles with adjustable difficulty.",
        icon: "layers",
      }),
    ];

    this.showcase = new ShowcaseContent({
      eyebrow: "The live experience",
      title: "An interviewer that listens, probes and pushes back",
      description:
        "Aria does not read from a script. She reacts to your answers — asking follow-ups, requesting specifics and keeping the clock running like a real panel would.",
      bullets: [
        "Natural back-and-forth voice with realistic turn-taking",
        "Follow-up questions that dig into what you actually did",
        "Clarifying prompts when an answer is too vague",
        "Stays on your role, level and the job description you chose",
      ],
      panelTitle: "Live mock session",
      panelSubtitle: "Senior Frontend Engineer · Behavioral round",
      liveLabel: "Live",
      messages: [
        new ConversationMessage({
          role: "interviewer",
          text: "Thanks for joining. Let us start easy — tell me about a project on your resume you are most proud of.",
        }),
        new ConversationMessage({
          role: "candidate",
          text: "I led the migration of our checkout flow to a server-rendered architecture, which cut load time by 40%.",
        }),
        new ConversationMessage({
          role: "interviewer",
          text: "Nice. What was the hardest tradeoff you had to make during that migration?",
        }),
        new ConversationMessage({
          role: "candidate",
          text: "We deferred personalization for two sprints to keep the rollout risk low.",
        }),
        new ConversationMessage({
          role: "interviewer",
          text: "Good answer — next time, quantify the risk you avoided. Moving on to a technical question.",
        }),
      ],
      footerNote: "Average session: 25 minutes · 12 questions",
      cta: new Action({ label: "Start your free interview", href: routes.signup }),
    });

    this.report = new ReportContent({
      eyebrow: "Your report",
      title: "Every interview ends with a plan, not a guess",
      description:
        "Scores are broken down by skill, mapped to your target role and paired with concrete fixes you can practice before the real thing.",
      roleLabel: "Senior Frontend Engineer · Mock interview",
      dateLabel: "Completed today · 24 min",
      overallLabel: "Overall",
      overallScore: 86,
      summary:
        "Strong structure and clarity. Sharpen conciseness under time pressure and lead with measurable impact.",
      skillsLabel: "Skill breakdown",
      strengthsLabel: "Strengths",
      improvementsLabel: "Areas to improve",
      skills: [
        new SkillScore({ label: "Communication", value: 88 }),
        new SkillScore({ label: "Confidence", value: 76 }),
        new SkillScore({ label: "Technical depth", value: 84 }),
        new SkillScore({ label: "Clarity", value: 91 }),
      ],
      strengths: [
        "Clear, structured answers with a strong opening line",
        "Confident pacing and minimal filler words",
        "Strong technical depth on frontend architecture",
        "Good clarification questions before answering",
      ],
      improvements: [
        "Lead with the result, then the story (STAR order)",
        "Keep answers under 90 seconds to respect the timer",
        "Quantify impact with numbers wherever possible",
        "Prepare two failure stories with real takeaways",
      ],
      cta: new Action({ label: "Get your own report", href: routes.signup }),
    });

    this.faqs = [
      new Faq({
        question: "How does the AI decide which questions to ask?",
        answer:
          "It reads your resume, the role and level you select, then builds a question set around your real experience — projects, skills and gaps — while following a standard interview structure for that role.",
      }),
      new Faq({
        question: "Does it feel like a real interview?",
        answer:
          "Yes. You speak out loud to a live AI avatar with natural turn-taking, follow-up questions and time pressure. Most candidates say the nerves feel surprisingly real by question three.",
      }),
      new Faq({
        question: "Which roles and industries are supported?",
        answer:
          "Over 50 roles across engineering, product, design, data, marketing and finance — from intern to staff level — including behavioral, technical and case-style rounds.",
      }),
      new Faq({
        question: "What do I get after the interview?",
        answer:
          "An overall score, skill-level breakdowns for communication, confidence, technical depth and clarity, a list of strengths, prioritized areas to improve and specific practice tips.",
      }),
      new Faq({
        question: "Is my resume and interview data private?",
        answer:
          "Your resume is used only to tailor your sessions. Data is encrypted in transit and at rest, never sold, and you can delete it from your account at any time.",
      }),
      new Faq({
        question: "Is there a free plan?",
        answer:
          "Yes. Your first interview and full report are free — no credit card required. Upgrade any time for unlimited interviews, more roles and progress tracking.",
      }),
    ];

    this.cta = new CtaContent({
      eyebrow: "Ready when you are",
      title: "Your next interview is closer than you think",
      titleHighlight: "closer than you think",
      description:
        "Run a realistic mock interview tonight and walk into the real one with a plan.",
      primaryAction: new Action({ label: "Start your free interview", href: routes.signup }),
      secondaryAction: new Action({ label: "See a sample report", href: "#report" }),
      note: "Free first interview · No credit card required",
    });

    const year = new Date().getFullYear();
    this.footer = new FooterContent({
      tagline: `${brand.name} turns practice into offers — realistic AI mock interviews with feedback you can act on.`,
      columns: [
        new FooterColumn({
          title: "Product",
          links: [
            new NavLink({ label: "Features", href: "#features" }),
            new NavLink({ label: "How it works", href: "#how-it-works" }),
            new NavLink({ label: "Report", href: "#report" }),
            new NavLink({ label: "FAQ", href: "#faq" }),
          ],
        }),
        new FooterColumn({
          title: "Company",
          links: [
            new NavLink({ label: "About", href: "#" }),
            new NavLink({ label: "Blog", href: "#" }),
            new NavLink({ label: "Careers", href: "#" }),
          ],
        }),
        new FooterColumn({
          title: "Resources",
          links: [
            new NavLink({ label: "Sample questions", href: "#" }),
            new NavLink({ label: "Interview guides", href: "#" }),
            new NavLink({ label: "Help center", href: "#" }),
          ],
        }),
        new FooterColumn({
          title: "Legal",
          links: [
            new NavLink({ label: "Privacy policy", href: "#" }),
            new NavLink({ label: "Terms of service", href: "#" }),
            new NavLink({ label: "Security", href: "#" }),
          ],
        }),
      ],
      socials: [
        new SocialLink({ label: "X (Twitter)", href: "#", icon: "twitter" }),
        new SocialLink({ label: "LinkedIn", href: "#", icon: "linkedin" }),
        new SocialLink({ label: "GitHub", href: "#", icon: "github" }),
      ],
      copyright: `© ${year} ${brand.name}. All rights reserved.`,
      closingNote: "Built for candidates who prepare with intent.",
    });
  }

  static getInstance(): LandingContentService {
    if (LandingContentService.instance === null) {
      LandingContentService.instance = new LandingContentService();
    }
    return LandingContentService.instance;
  }

  getNavLinks(): readonly NavLink[] {
    return this.navLinks;
  }

  getHero(): HeroContent {
    return this.hero;
  }

  getStats(): readonly Stat[] {
    return this.stats;
  }

  getSteps(): readonly Step[] {
    return this.steps;
  }

  getFeatures(): readonly Feature[] {
    return this.features;
  }

  getShowcase(): ShowcaseContent {
    return this.showcase;
  }

  getReport(): ReportContent {
    return this.report;
  }

  getFaqs(): readonly Faq[] {
    return this.faqs;
  }

  getCta(): CtaContent {
    return this.cta;
  }

  getFooter(): FooterContent {
    return this.footer;
  }
}

export const landingContentService = LandingContentService.getInstance();
