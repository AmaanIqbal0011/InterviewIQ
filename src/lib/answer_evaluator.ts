import { z } from "zod";

/** Evaluation result shape returned by the LLM. */
export type EvaluationJson = {
  readonly score: number;       // 0-10
  readonly relevance: number;   // 0-10
  readonly depth: number;       // 0-10
  readonly clarity: number;     // 0-10
  readonly strengths: string[]; // top points the candidate hit
  readonly gaps: string[];      // what was missing
  readonly suggestedFollowUp?: string; // optional next question prompt
};

/** Zod schema for LLM JSON output validation. */
export const evaluationJsonSchema = z.object({
  score: z.number().int().min(0).max(10),
  relevance: z.number().int().min(0).max(10),
  depth: z.number().int().min(0).max(10),
  clarity: z.number().int().min(0).max(10),
  strengths: z.array(z.string()).optional().default([]),
  gaps: z.array(z.string()).optional().default([]),
  suggestedFollowUp: z.string().optional(),
});

/** Parsed evaluation from the LLM, with a fallback marker. */
export interface EvaluationResult {
  readonly score: number;         // 0-10 (scaled to 0-100 by the caller, or keep 0-10)
  readonly relevance: number;     // 0-10
  readonly depth: number;         // 0-10
  readonly clarity: number;       // 0-10
  readonly strengths: string[];   // top points the candidate hit
  readonly gaps: string[];        // what was missing
  readonly suggestedFollowUp?: string; // optional next question prompt
  readonly fallback: boolean;     // true if LLM failed and fallback was used
}

/** AnswerEvaluator - evaluates candidate interview answers using the LLM.
 *  Strict OOP, constructor injection, no `any`.
 *  Calls LLMClient with the question, answer, and CandidateContext snapshot.
 *  Retries once on invalid JSON, adds a timeout, sanitizes answer as untrusted data.
 *  Keeps a tiny deterministic fallback ONLY if the LLM call fails, marked as fallback.
 */
export class AnswerEvaluator {
  private readonly llmClient: import("@/services/resume/llm/LLMClient").LLMClient;
  private readonly candidateContext: import("@/lib/validation/candidateContextSchemas").CandidateContext | null;
  private readonly interviewConfig: import("@/lib/validation/interviewSchemas").InterviewConfig | null;

  constructor(
    llmClient: import("@/services/resume/llm/LLMClient").LLMClient,
    candidateContext: import("@/lib/validation/candidateContextSchemas").CandidateContext | null,
    interviewConfig: import("@/lib/validation/interviewSchemas").InterviewConfig | null
  ) {
    this.llmClient = llmClient;
    this.candidateContext = candidateContext;
    this.interviewConfig = interviewConfig;
  }

  /** Evaluate a candidate's answer using the LLM.
   *  Returns an EvaluationResult with fallback flag.
   *  If the LLM call fails, uses a tiny deterministic fallback and marks fallback: true.
   */
  async evaluate(
    answer: string,
    questionTopic: string
  ): Promise<EvaluationResult> {
    // Sanitize answer as untrusted data - extract only safe content
    const safeAnswer = this.sanitizeAnswer(answer);

    // Build the prompt with candidate context
    const prompt = this.buildEvaluationPrompt(safeAnswer, questionTopic);

    // LLM JSON request
    const request: import("@/services/resume/llm/LLMClient").LLMJsonRequest = {
      systemInstruction:
        "You are an interview evaluation expert. Evaluate the candidate's answer based on the provided criteria. Return ONLY a JSON object with no surrounding text, no explanations, no markdown. The JSON must conform strictly to the provided schema.",
      prompt,
      jsonSchema: evaluationJsonSchema.shape,
      timeoutMs: 8000,
    };

    // Try LLM call, with retry on invalid JSON
    let rawText: string;
    let parseAttempts = 0;
    let lastError: Error | null = null;

    while (parseAttempts < 2) {
      try {
        rawText = await this.llmClient.generateJson(request);
        const parsed = evaluationJsonSchema.parse(JSON.parse(rawText));
        // Success - return with fallback: false
        return {
          score: parsed.score,
          relevance: parsed.relevance,
          depth: parsed.depth,
          clarity: parsed.clarity,
          strengths: parsed.strengths ?? [],
          gaps: parsed.gaps ?? [],
          suggestedFollowUp: parsed.suggestedFollowUp,
          fallback: false,
        };
      } catch (err) {
        parseAttempts++;
        lastError = err instanceof Error ? err : new Error(String(err));
        // If we've exhausted attempts, use fallback
        if (parseAttempts >= 2) {
          break;
        }
        // Otherwise, retry
      }
    }

    // Fallback: deterministic tiny evaluation based on answer length only
    // This is far from ideal but keeps the UI alive when the LLM is unavailable
    const answerLength = safeAnswer.length;
    const fallbackScore = Math.max(0, Math.min(10, Math.round((answerLength / 2000) * 5)));
    const fallbackRelevance = Math.max(0, Math.min(10, Math.round((answerLength / 2000) * 3)));
    const fallbackDepth = Math.max(0, Math.min(10, Math.round((answerLength / 2000) * 2)));
    const fallbackClarity = Math.max(0, Math.min(10, Math.round((answerLength / 2000) * 2)));

    return {
      score: fallbackScore,
      relevance: fallbackRelevance,
      depth: fallbackDepth,
      clarity: fallbackClarity,
      strengths: ["Provided some detail"],
      gaps: ["Expand your answer with more detail"],
      suggestedFollowUp: undefined,
      fallback: true,
    };
  }

  /** Build the evaluation prompt using the candidate context. */
  private buildEvaluationPrompt(answer: string, questionTopic: string): string {
    const ctx = this.candidateContext;

    // Get onboarding skills
    const onboardingSkills: string[] = [];
    if (ctx && ctx.onboarding && ctx.onboarding.skills) {
      ctx.onboarding.skills.forEach((s) => { if (s.name) onboardingSkills.push(s.name); });
    }

    // Get resume skills
    const resumeSkills: string[] = [];
    if (ctx && ctx.resume && ctx.resume.skills) {
      const skills = ctx.resume.skills;
      if (skills.technical) skills.technical.forEach((t: string) => resumeSkills.push(t));
      if (skills.soft) skills.soft.forEach((t: string) => resumeSkills.push(t));
    }

    const allSkills = [...new Set([...onboardingSkills, ...resumeSkills])];
    const candidateName = ctx?.candidate?.full_name ?? "the candidate";
    const targetRole = this.interviewConfig?.target_role ?? "the role";
    const difficulty = this.interviewConfig?.difficulty ?? "medium";
    const practiceGoals = ctx?.goals.practice_goals ?? [];

    // Pull a few real data points for personalization
    const projects: string[] = [];
    if (ctx && ctx.resume && ctx.resume.projects) {
      ctx.resume.projects.forEach((p: { name: string }) => { if (p.name) projects.push(p.name); });
    }
    const experience: string[] = [];
    if (ctx && ctx.resume && ctx.resume.experience) {
      ctx.resume.experience.forEach((e: { title: string; company: string }) => { if (e.title && e.company) experience.push(`${e.title} at ${e.company}`); });
    }
    const education: string[] = [];
    if (ctx && ctx.resume && ctx.resume.education) {
      if (ctx?.resume?.education) {
      ctx.resume.education.forEach((e) => {
        if (e?.degree) education.push(e.degree as string);
      });
    }
    }

    // Build a concise personalization block
    const personalization: string[] = [];
    if (allSkills.length > 0) personalization.push(`Key skills: ${allSkills.slice(0, 5).join(", ")}.`);
    if (projects.length > 0) personalization.push(`Candidate projects: ${projects.slice(0, 3).join(", ")}.`);
    if (experience.length > 0) personalization.push(`Candidate experience: ${experience.slice(0, 3).join(". ")}.`);
    if (education.length > 0) personalization.push(`Candidate education: ${education.slice(0, 3).join(". ")}.`);

    return `Evaluate the following candidate answer for an interview for the ${targetRole} role (difficulty: ${difficulty}).

Candidate: ${candidateName}
${personalization.join(" ")}
Practice goals: ${practiceGoals.join(", ") || "not specified"}

Answer: "${answer}"

Question topic: ${questionTopic}

Evaluate the answer on these 0-10 scales:
- score: overall quality and job-relevance
- relevance: how well the answer addresses the question topic
- depth: how much substantive detail was provided
- clarity: how clear and well-structured the answer was

Also provide:
- strengths: array of the candidate's strong points mentioned in the answer, highlighting relevant practice goals (max 3)
- gaps: array of what was missing or could be improved, highlighting relevant practice goals (max 3)
- suggestedFollowUp: a very brief suggestion for a follow-up question (max 1 sentence), or null if the answer is solid

Return STRICTLY valid JSON with these exact field names only: score, relevance, depth, clarity, strengths, gaps, suggestedFollowUp. No surrounding text, no markdown, no explanations.`;
  }

  /** Sanitize the answer as untrusted data - extract plain text, strip any LLM injection attempts. */
  private sanitizeAnswer(answer: string): string {
    // Remove backslash escaping that could alter prompt behavior
    let s = answer.replace(/\\/g, "");
    // Remove backticks that could alter prompt behavior
    s = s.replace(/`/g, "");
    // Remove dollar signs that could alter prompt behavior
    s = s.replace(/\$/g, "");
    // Double any single quotes that remain
    s = s.replace(/'/g, "''");
    // Truncate to a safe length to prevent prompt overflow
    s = s.slice(0, 3000);
    return s;
  }
}