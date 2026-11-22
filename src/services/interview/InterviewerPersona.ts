import type { InterviewConfig, InterviewLanguage } from "@/lib/validation/interviewSchemas";

export interface InterviewerPersonaProps {
  /** How the interviewer introduces themselves. */
  readonly name: string;
  /** Short credibility line used in the greeting. */
  readonly title: string;
  /** Emotional register, e.g. "warm, calm, encouraging". */
  readonly tone: string;
  /** How they run the conversation, e.g. "concise, curious, follows up on specifics". */
  readonly style: string;
  /** Language the interviewer conducts the session in. */
  readonly language: InterviewLanguage;
}

/** Preset personas keyed by interview type; each can be overridden per session. */
const PRESETS: Record<InterviewConfig["interview_type"], InterviewerPersonaProps> = {
  technical: {
    name: "Daniel Reyes",
    title: "senior software engineer",
    tone: "warm, calm and genuinely curious",
    style: "asks short follow-ups about trade-offs, keeps answers to one question at a time",
    language: "english",
  },
  hr: {
    name: "Amara Okafor",
    title: "talent partner",
    tone: "friendly, patient and encouraging",
    style: "keeps things conversational, probes for concrete examples, never interrogates",
    language: "english",
  },
  mixed: {
    name: "Priya Nair",
    title: "hiring manager",
    tone: "professional yet relaxed",
    style: "moves naturally between people questions and role questions, one at a time",
    language: "english",
  },
};

/**
 * Who the interviewer is: name, tone and style.
 *
 * Kept separate from prompting so the persona can be swapped (or localised)
 * without touching any conversation logic.
 */
export class InterviewerPersona {
  readonly name: string;
  readonly title: string;
  readonly tone: string;
  readonly style: string;
  readonly language: InterviewLanguage;

  constructor(props: InterviewerPersonaProps) {
    this.name = props.name;
    this.title = props.title;
    this.tone = props.tone;
    this.style = props.style;
    this.language = props.language;
  }

  /** Persona preset for the interview type, with the chosen interview language. */
  static forInterview(config: Pick<InterviewConfig, "interview_type" | "interview_language">): InterviewerPersona {
    const preset = PRESETS[config.interview_type];
    return new InterviewerPersona({ ...preset, language: config.interview_language });
  }

  /** A short natural greeting the fallback path can use verbatim. */
  greeting(firstName: string | null): string {
    const address = firstName ? `Hi ${firstName}, ` : "Hi, ";
    return `${address}I'm ${this.name}, ${this.title}. Thanks for making the time — let's dive in.`;
  }

  /** The fallback closing line, used when the model is unavailable. */
  closing(firstName: string | null): string {
    const address = firstName ? `Thanks, ${firstName}. ` : "Thanks. ";
    return `${address}That's all the time we have today — I really appreciate you talking with me. I'll put your feedback together and you can read it right after this.`;
  }

  /** The persona block injected into every system prompt. */
  describe(): string {
    return [
      `Interviewer persona: ${this.name}, ${this.title}.`,
      `Tone: ${this.tone}.`,
      `Style: ${this.style}.`,
      `Conduct the whole interview in ${this.language === "urdu_hinglish" ? "Urdu/Hinglish (Roman Urdu is fine, mixing naturally with English)" : "English"}.`,
    ].join("\n");
  }
}
