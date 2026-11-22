import { z } from "zod";
import type { LLMClient, LLMJsonRequest } from "@/services/resume/llm/LLMClient";
import type { CandidateProfile } from "./CandidateProfile";
import type { InterviewerPersona } from "./InterviewerPersona";
import { interviewMoves, type InterviewMove } from "./InterviewPromptBuilder";
import type { InterviewPhase } from "./InterviewTimer";

const TIMEOUT_MS = 9000;
const MAX_ATTEMPTS = 2;

/** One thing the interviewer says on this turn. */
export interface GeneratedTurn {
  readonly move: InterviewMove;
  readonly text: string;
  readonly topic: string | null;
  /** True when the model was unavailable and a deterministic line was used. */
  readonly fallback: boolean;
}

export interface TurnGenerationRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly allowedMoves: readonly InterviewMove[];
  readonly phase: InterviewPhase;
  /** Used only to phrase deterministic fallback lines. */
  readonly persona: InterviewerPersona;
  readonly profile: CandidateProfile;
}

const turnSchema = z.object({
  move: z.enum(interviewMoves),
  text: z
    .string()
    .trim()
    .min(8, "The interviewer line is too short.")
    .max(800, "Keep the interviewer line under 800 characters."),
  topic: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

const OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    move: { type: "STRING", enum: [...interviewMoves] },
    text: { type: "STRING" },
    topic: { type: "STRING", nullable: true },
  },
  required: ["move", "text"],
};

const OUTPUT_CONTRACT = `Exact JSON schema:
{"type":"object","properties":{"move":{"type":"string","enum":["open","probe","question","wrap_up","closing"]},"text":{"type":"string","minLength":8,"maxLength":800},"topic":{"type":["string","null"]}},"required":["move","text"],"additionalProperties":false}

Valid example:
{"move":"probe","text":"Got it — what specifically did you change to make it faster?","topic":"performance"}`;

/**
 * Produces the next thing the interviewer says, via one validated LLM call.
 *
 * Owns only generation: prompt text comes from {@link InterviewPromptBuilder}
 * and persistence from {@link InterviewSession}. If the model fails or returns
 * something unusable, it falls back to a phase-appropriate line so the
 * conversation never stalls.
 */
export class InterviewTurnGenerator {
  /** Prompt text for the output contract; injected into the prompt builder. */
  static readonly OUTPUT_CONTRACT = OUTPUT_CONTRACT;

  private readonly llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async generate(request: TurnGenerationRequest): Promise<GeneratedTurn> {
    const allowed = request.allowedMoves.length > 0 ? request.allowedMoves : ["question"] as const;
    const base: LLMJsonRequest = {
      systemInstruction: `${request.systemPrompt}\n\n${OUTPUT_CONTRACT}`,
      prompt: request.userPrompt,
      jsonSchema: OUTPUT_SCHEMA,
      timeoutMs: TIMEOUT_MS,
    };

    let validationError = "";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const raw = await this.llm.generateJson({
          ...base,
          prompt:
            attempt === 0
              ? base.prompt
              : `${base.prompt}\n\nCorrection: your previous response failed validation (${validationError}). Return only the required JSON object.`,
        });
        const parsed = turnSchema.parse(
          JSON.parse(InterviewTurnGenerator.extractJsonObject(raw)) as unknown,
        );
        return {
          move: InterviewTurnGenerator.clampMove(parsed.move, allowed),
          text: parsed.text,
          topic: parsed.topic,
          fallback: false,
        };
      } catch (error) {
        validationError = InterviewTurnGenerator.describeError(error);
        if (attempt === MAX_ATTEMPTS - 1) {
          console.error("InterviewTurnGenerator failed; using deterministic line", {
            phase: request.phase,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }
    }

    return this.fallbackTurn(request);
  }

  /** Phase-appropriate line used when the model is unavailable or off-contract. */
  private fallbackTurn(request: TurnGenerationRequest): GeneratedTurn {
    const firstName = request.profile.firstName;
    const move = InterviewTurnGenerator.clampMove(
      request.allowedMoves[0] ?? "question",
      request.allowedMoves,
    );

    if (move === "closing" || request.phase === "ENDED") {
      return {
        move: "closing",
        text: request.persona.closing(firstName),
        topic: null,
        fallback: true,
      };
    }
    if (move === "wrap_up") {
      return {
        move: "wrap_up",
        text: "We're almost out of time — before I let you go, do you have any questions for me?",
        topic: "wrap_up",
        fallback: true,
      };
    }
    if (move === "open") {
      const greeting = firstName
        ? `Thanks for making the time, ${firstName}.`
        : "Thanks for making the time.";
      return {
        move: "open",
        text: `${greeting} I'm ${request.persona.name}. To get started, tell me a bit about yourself.`,
        topic: "introduction",
        fallback: true,
      };
    }
    if (move === "probe") {
      return {
        move: "probe",
        text: "Got it — could you walk me through that in a bit more detail?",
        topic: null,
        fallback: true,
      };
    }
    return {
      move: "question",
      text: "What's a project you're proud of, and what made it hard?",
      topic: request.profile.skills[0] ?? "general",
      fallback: true,
    };
  }

  /** Keeps the model inside the moves the current phase allows. */
  private static clampMove(move: InterviewMove, allowed: readonly InterviewMove[]): InterviewMove {
    return allowed.includes(move) ? move : (allowed[0] ?? "question");
  }

  private static extractJsonObject(rawText: string): string {
    const text = rawText.replace(/```(?:json)?/gi, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new SyntaxError("LLM output did not contain a JSON object.");
    }
    return text.slice(start, end + 1);
  }

  private static describeError(error: unknown): string {
    if (error instanceof z.ZodError) {
      return error.issues
        .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
    }
    return error instanceof Error ? error.message : "unknown error";
  }
}
