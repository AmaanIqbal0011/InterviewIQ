import { GoogleGenAI } from "@google/genai";
import { ParsingError } from "@/lib/errors/ResumeError";
import type { LLMClient, LLMJsonRequest } from "./LLMClient";

export interface GeminiLLMClientOptions {
  readonly apiKey: string;
  readonly model: string;
  /** Injectable for tests; production builds create the real SDK client. */
  readonly client?: GoogleGenAI;
}

/**
 * Gemini implementation of LLMClient. Structured output is enforced by
 * `responseJsonSchema`, and every call is bounded by a hard timeout.
 */
export class GeminiLLMClient implements LLMClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiLLMClientOptions) {
    this.client =
      options.client ??
      // The SDK defaults to `v1`, which rejects system instructions and
      // `responseJsonSchema`. Both require `v1beta`.
      new GoogleGenAI({ apiKey: options.apiKey, apiVersion: "v1beta" });
    this.model = options.model;
  }

  async generateJson(request: LLMJsonRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
          temperature: 0.1,
          // Thinking tokens count against this budget, so leave headroom for
          // longer resumes without truncating the JSON object.
          maxOutputTokens: 8192,
          abortSignal: controller.signal,
        },
      });

      const text = response.text;
      if (!text || !text.trim()) {
        throw new ParsingError();
      }
      return text;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ParsingError({
          cause: error,
          message: "Resume parsing took too long. Please try again.",
        });
      }
      if (error instanceof ParsingError) throw error;
      throw new ParsingError({ cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}
