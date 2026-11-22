import { describe, expect, it } from "vitest";
import { InterviewTimer } from "@/services/interview/InterviewTimer";

const START = "2026-01-01T10:00:00.000Z";

function timer(options: Partial<ConstructorParameters<typeof InterviewTimer>[0]> = {}) {
  return new InterviewTimer({
    durationSeconds: 300,
    startedAt: START,
    ...options,
  });
}

function at(secondsAfterStart: number, extra: Partial<ConstructorParameters<typeof InterviewTimer>[0]> = {}) {
  return timer({ nowMs: Date.parse(START) + secondsAfterStart * 1000, ...extra });
}

describe("InterviewTimer", () => {
  it("reports the configured length in seconds", () => {
    expect(InterviewTimer.secondsFor("3")).toBe(180);
    expect(InterviewTimer.secondsFor("15")).toBe(900);
    expect(InterviewTimer.durationSecondsFor({ duration_minutes: "10" })).toBe(600);
  });

  it("counts down from the configured duration", () => {
    expect(at(0).remainingSeconds).toBe(300);
    expect(at(60).remainingSeconds).toBe(240);
    expect(at(60).elapsedSeconds).toBe(60);
  });

  it("never goes negative once the clock passes the buzzer", () => {
    const overdue = at(400);
    expect(overdue.remainingSeconds).toBe(0);
    expect(overdue.elapsedSeconds).toBe(300);
  });

  it("starts in OPENING and moves to MAIN after the first answer", () => {
    expect(at(5).phase).toBe("OPENING");
    expect(at(5, { openingComplete: true }).phase).toBe("MAIN");
  });

  it("enters WRAP_UP in the last 45 seconds", () => {
    expect(at(254, { openingComplete: true }).phase).toBe("MAIN");
    expect(at(255, { openingComplete: true }).phase).toBe("WRAP_UP");
  });

  it("ends at zero even when the row is not yet marked completed", () => {
    expect(at(300, { openingComplete: true }).phase).toBe("ENDED");
    expect(at(300, { openingComplete: true }).isOutOfTime).toBe(true);
  });

  it("ends immediately when the row is completed", () => {
    const done = at(10, { completed: true, openingComplete: true });
    expect(done.phase).toBe("ENDED");
    expect(done.remainingSeconds).toBe(0);
    expect(done.isOutOfTime).toBe(false);
  });

  it("treats a session still in setup as having the full duration left", () => {
    const fresh = new InterviewTimer({
      durationSeconds: 180,
      startedAt: null,
      openingComplete: true,
    });
    expect(fresh.remainingSeconds).toBe(180);
    expect(fresh.phase).toBe("MAIN");
  });

  it("formats the countdown as m:ss", () => {
    expect(at(0).formatRemaining()).toBe("5:00");
    expect(at(255).formatRemaining()).toBe("0:45");
    expect(at(300).formatRemaining()).toBe("0:00");
  });

  it("describes the remaining time in plain words", () => {
    expect(at(0).describeTime()).toBe("5 minutes remaining");
    expect(at(295).describeTime()).toBe("5 seconds remaining");
    expect(at(150).describeTime()).toBe("2 minutes and 30 seconds remaining");
    expect(at(300).describeTime()).toBe("the interview has ended");
  });

  it("allows new topics only before the wrap-up", () => {
    expect(at(10, { openingComplete: true }).canOpenNewTopic).toBe(true);
    expect(at(270, { openingComplete: true }).canOpenNewTopic).toBe(false);
  });
});
