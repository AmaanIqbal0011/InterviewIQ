import { ParsingError } from "@/lib/errors/ResumeError";
import { GeminiLLMClient } from "./GeminiLLMClient";
import type { LLMClient } from "./LLMClient";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

/**
 * Reads provider configuration from the server environment. The rest of the
 * app depends only on LLMClient, so adding another provider means adding one
 * branch here and one implementation class.
 */
export function createLLMClientFromEnv(): LLMClient {
  const provider = (process.env.RESUME_LLM_PROVIDER ?? "gemini").toLowerCase();

  if (provider !== "gemini") {
    throw new ParsingError({
      message: `Resume parsing provider "${provider}" is not configured.`,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ParsingError({
      message:
        "Resume parsing isn't configured yet. Add GEMINI_API_KEY to the server environment.",
    });
  }

  return new GeminiLLMClient({
    apiKey,
    model: process.env.RESUME_LLM_MODEL || DEFAULT_GEMINI_MODEL,
  });
}

export function getLLMTimeoutMs(): number {
  const configured = Number(process.env.RESUME_LLM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_LLM_TIMEOUT_MS;
}
