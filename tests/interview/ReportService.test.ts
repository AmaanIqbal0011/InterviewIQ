import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReportService } from "@/services/interview/ReportService";
import type { Database, Json } from "@/types/database";

// ---------------------------------------------------------------- fake supabase

type Op = "select" | "insert" | "update" | "upsert";
type QueryResult = { data: unknown; error: null | { message: string; code?: string } };
type Handler = (table: string, op: Op, payload: unknown) => QueryResult;

/** Minimal PostgREST chain: records the operation, resolves at the terminal call. */
class FakeQuery {
  private op: Op = "select";
  private payload: unknown = null;

  constructor(
    private readonly table: string,
    private readonly handler: Handler,
  ) {}

  select(): this {
    return this;
  }
  insert(payload: unknown): this {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: unknown): this {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: unknown): this {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }
  eq(): this {
    return this;
  }
  in(): this {
    return this;
  }
  order(): this {
    return this;
  }
  limit(): this {
    return this;
  }

  async maybeSingle(): Promise<QueryResult> {
    const result = this.handler(this.table, this.op, this.payload);
    if (!Array.isArray(result.data)) return result;
    return { ...result, data: result.data[0] ?? null };
  }

  async single(): Promise<QueryResult> {
    const result = await this.maybeSingle();
    if (result.error === null && result.data === null) {
      return { data: null, error: { message: "No rows returned" } };
    }
    return result;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onFulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.handler(this.table, this.op, this.payload)).then(
      onFulfilled,
      onRejected,
    );
  }
}

function createSupabase(handler: Handler) {
  return {
    from(table: string) {
      return new FakeQuery(table, handler);
    },
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------- fixtures

const USER_ID = "user-1";
const INTERVIEW_ID = "interview-1";

const config = {
  target_role: "Frontend Engineer",
  experience_level: "mid",
  interview_type: "technical",
  difficulty: "medium",
  duration_minutes: "5",
  interview_language: "english",
  focus_topics: ["React"],
  use_resume: false,
};

const context = {
  candidate: { full_name: "Ada Lovelace", country: null, city: null, current_status: "Student" },
  goals: {
    target_role: "Frontend Engineer",
    target_industry: null,
    experience_level: "mid",
    target_companies: [],
    interview_type: "technical",
    difficulty: "medium",
    interview_language: "english",
    practice_goals: [],
    additional_notes: null,
  },
  onboarding: {
    education: [],
    work_experience: [],
    skills: [{ name: "React", category: "technical", level: "advanced" }],
    languages: [{ language: "English", proficiency: "native", is_interview_language: true }],
  },
  resume: null,
  has_completed_resume: false,
};

const turns = [
  {
    question_text: "Tell me about yourself.",
    topic: "introduction",
    answer_text: "I build dashboards in React.",
    evaluation: {
      move: "open",
      score: 8,
      relevance: 8,
      depth: 7,
      clarity: 9,
      strengths: ["Clear structure"],
      gaps: ["Could add metrics"],
    } as Json,
  },
  {
    question_text: "What is a hook you reach for?",
    topic: "React",
    answer_text: "useState, mostly.",
    evaluation: {
      move: "question",
      score: 6,
      relevance: 7,
      depth: 5,
      clarity: 8,
      strengths: ["Direct answer"],
      gaps: ["Missing an example"],
    } as Json,
  },
];

interface ScenarioOptions {
  readonly status?: string;
  readonly reportStatus?: string;
  readonly reportRow?: Record<string, unknown> | null;
  /** Simulates an unreadable context snapshot (generation blows up). */
  readonly brokenContext?: boolean;
}

/** Wires a fake DB for one report request, recording every write it receives. */
function scenario(options: ScenarioOptions = {}) {
  const writes: { table: string; op: Op; payload: unknown }[] = [];

  const handler: Handler = (table, op, payload) => {
    writes.push({ table, op, payload });

    if (table === "interviews" && op === "select") {
      return {
        data: {
          status: options.status ?? "completed",
          config,
          context_snapshot: options.brokenContext ? null : context,
          started_at: new Date(Date.now() - 120_000).toISOString(),
          completed_at: new Date(Date.now() - 10_000).toISOString(),
          report_status: options.reportStatus ?? "pending",
        },
        error: null,
      };
    }
    if (table === "interviews" && op === "update") return { data: [{ id: INTERVIEW_ID }], error: null };
    if (table === "interview_turns" && op === "select") return { data: turns, error: null };
    if (table === "interview_reports" && op === "select") {
      return { data: options.reportRow ?? null, error: null };
    }
    if (table === "interview_reports" && op === "upsert") return { data: null, error: null };
    return { data: null, error: null };
  };

  return { supabase: createSupabase(handler), writes };
}

function service(options: ScenarioOptions = {}) {
  const { supabase, writes } = scenario(options);
  return {
    writes,
    ensure: () =>
      new ReportService({
        supabase,
        userId: USER_ID,
        interviewId: INTERVIEW_ID,
      }).ensureReport(),
  };
}

// ---------------------------------------------------------------- tests

describe("ReportService.ensureReport", () => {
  it("does nothing while the interview is still running", async () => {
    const { ensure, writes } = service({ status: "in_progress" });

    await expect(ensure()).resolves.toBeNull();
    expect(writes.filter((write) => write.op !== "select")).toHaveLength(0);
  });

  it("generates from the transcript and marks the report ready", async () => {
    const { ensure, writes } = service();

    const report = await ensure();
    if (!report) throw new Error("expected a report");

    expect(report.fallback).toBe(true); // no provider key in tests
    expect(report.summary?.length ?? 0).toBeGreaterThan(40);
    expect(report.strengths).toContain("Clear structure");
    expect(report.weaknesses).toContain("Missing an example");
    expect(report.focusNext.length).toBeGreaterThan(0);
    expect(report.durationSeconds).toBeGreaterThan(0);
    expect(report.durationSeconds).toBeLessThanOrEqual(300);
    expect(report.questionFeedback).toHaveLength(2);

    const upsert = writes.find((write) => write.table === "interview_reports" && write.op === "upsert");
    expect(upsert).toBeDefined();
    expect((upsert?.payload as { summary: string }).summary).toBe(report.summary);

    const status = writes.find(
      (write) =>
        write.table === "interviews" &&
        write.op === "update" &&
        (write.payload as { report_status?: string }).report_status === "ready",
    );
    expect(status).toBeDefined();
  });

  it("serves the stored row without regenerating once ready", async () => {
    const stored = {
      summary: "Already written.",
      strengths: ["Good pace"],
      weaknesses: ["Vague examples"],
      improvement_plan: ["Practise STAR"],
      category_scores: { Relevance: 7 },
      question_feedback: [{ question: "Tell me about yourself.", topic: "introduction", score: 8, verdict: "Strong." }],
      cv_insights: [],
      overall_score: 80,
      duration_seconds: 240,
    };
    const { ensure, writes } = service({ reportStatus: "ready", reportRow: stored });

    const report = await ensure();

    expect(report?.summary).toBe("Already written.");
    expect(report?.durationSeconds).toBe(240);
    expect(report?.categoryScores).toEqual({ Relevance: 7 });
    expect(report?.fallback).toBe(false);
    expect(writes.filter((write) => write.op === "upsert")).toHaveLength(0);
    expect(writes.filter((write) => write.table === "interview_turns")).toHaveLength(0);
  });

  it("still returns a usable deterministic report when generation blows up", async () => {
    const { ensure, writes } = service({ brokenContext: true });

    const report = await ensure();
    if (!report) throw new Error("expected a report");

    expect(report.fallback).toBe(true);
    expect(report.summary?.length ?? 0).toBeGreaterThan(40);
    // Scores still come from the transcript itself.
    expect(report.questionFeedback).toHaveLength(2);
    expect(report.questionFeedback[0]?.score).toBe(8);
    expect(report.strengths).toContain("Clear structure");

    const upsert = writes.find((write) => write.table === "interview_reports" && write.op === "upsert");
    expect(upsert).toBeDefined();
  });
});
