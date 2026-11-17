import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import type { AvatarState } from "@/lib/avatar/types";

describe("AvatarRenderer", () => {
  it("renders a status label for each avatar state", () => {
    const states: Array<[AvatarState, string]> = [
      ["idle", "Ready when you are"],
      ["listening", "Listening..."],
      ["thinking", "Thinking..."],
      ["speaking", "Speaking"],
    ];

    states.forEach(([state, label]) => {
      const markup = renderToStaticMarkup(
        createElement(AvatarRenderer, {
          state,
          mouthOpenness: 0.5,
          name: "Alex",
          caption: "What would you do next?",
        }),
      );
      expect(markup).toContain(`data-state="${state}"`);
      expect(markup).toContain(label);
      expect(markup).toContain("Alex");
      expect(markup.includes("What would you do next?")).toBe(state === "speaking");
    });
  });
});
