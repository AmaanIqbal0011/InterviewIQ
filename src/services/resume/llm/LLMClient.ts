/** Provider-agnostic contract for JSON generation, so swapping providers is a factory change. */

export interface LLMJsonRequest {
  readonly systemInstruction: string;
  readonly prompt: string;
  readonly jsonSchema: Record<string, unknown>;
  readonly timeoutMs: number;
}

export interface LLMClient {
  generateJson(request: LLMJsonRequest): Promise<string>;
}
