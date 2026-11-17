import { describe, expect, it } from "vitest";
import { calculateOverallScore } from "@/lib/scoring";

describe("calculateOverallScore", () => {
  it("returns null for an empty list", () => {
    expect(calculateOverallScore([])).toBeNull();
  });

  it("scales a single evaluated turn to 0-100", () => {
    expect(calculateOverallScore([{ score: 7 }])).toBe(70);
  });

  it("averages mixed evaluated and unevaluated turns", () => {
    expect(
      calculateOverallScore([
        { score: 8 },
        { fallback: true },
        { score: 6 },
        { score: 10 },
      ]),
    ).toBe(80);
  });

  it("rounds the scaled mean to the nearest integer", () => {
    expect(calculateOverallScore([{ score: 7 }, { score: 8 }, { score: 8 }])).toBe(77);
  });

  it("ignores turns without a valid score", () => {
    expect(
      calculateOverallScore([
        { score: 4 },
        { fallback: true },
        null,
        { score: 12 },
        { score: Number.NaN },
        { score: 8 },
      ]),
    ).toBe(60);
  });

  it("returns null when no turns have an evaluated score", () => {
    expect(calculateOverallScore([{ fallback: true }, { score: "8" }])).toBeNull();
  });
});
