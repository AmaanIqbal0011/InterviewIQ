import { describe, expect, it, vi } from "vitest";
import { ParsingError } from "@/lib/errors/ResumeError";
import { GeminiLLMClient } from "@/services/resume/llm/GeminiLLMClient";

const sdk = vi.hoisted(() => ({
  constructorOptions: [] as unknown[],
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    readonly models = { generateContent: sdk.generateContent };
    constructor(options: unknown) {
      sdk.constructorOptions.push(options);
    }
  },
}));

const request = {
  systemInstruction: "Extract the resume.",
  prompt: "<resume_text>Ada Lovelace</resume_text>",
  jsonSchema: { type: "object" },
  timeoutMs: 1000,
};

describe("GeminiLLMClient", () => {
  it("targets the v1beta API, which is required for system instructions", () => {
    sdk.constructorOptions.length = 0;

    new GeminiLLMClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    expect(sdk.constructorOptions).toHaveLength(1);
    expect(sdk.constructorOptions[0]).toMatchObject({
      apiKey: "test-key",
      apiVersion: "v1beta",
    });
  });

  it("returns the generated text", async () => {
    sdk.generateContent.mockResolvedValueOnce({ text: '{"headline":null}' });
    const client = new GeminiLLMClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.generateJson(request)).resolves.toBe('{"headline":null}');
  });

  it("wraps an empty response as a parsing error", async () => {
    sdk.generateContent.mockResolvedValueOnce({ text: "   " });
    const client = new GeminiLLMClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.generateJson(request)).rejects.toBeInstanceOf(ParsingError);
  });

  it("wraps provider failures with the user-safe message", async () => {
    sdk.generateContent.mockRejectedValueOnce(new Error("400 INVALID_ARGUMENT"));
    const client = new GeminiLLMClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    const error = await client.generateJson(request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ParsingError);
    expect((error as ParsingError).code).toBe("parsing_failed");
    expect((error as ParsingError).cause).toBeInstanceOf(Error);
  });
});
