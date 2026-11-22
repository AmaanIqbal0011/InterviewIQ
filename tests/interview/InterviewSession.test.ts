import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InterviewSession } from "@/services/interview/InterviewSession";
import { InterviewError } from "@/lib/errors/InterviewError";
import type { LLMClient, LLMJsonRequest } from "@/services/resume/llm/LLMClient";
import type { Database, Json } from "@/types/database";

// ---------------------------------------------------------------- fake supabase

type QueryResult = { data: unknown; error: null | { message: string; code?: string } };
type Handler = (table: string, op: "select" | "insert" | "update", payload: unknown) => QueryResult;

/** Minimal PostgREST chain: records the operation, resolves at the terminal call. */
class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
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

  eq(): this {
    return this;
  }
  is(): this {
    return this;
  }
  in(): this {
    return this;
  }
  gte(): this {
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

  /** Makes `await query` work for bare insert/update chains. */
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
  duration_minutes: "3",
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

function makeLLM(): LLMClient {
  return {
    generateJson: vi.fn(async (request: LLMJsonRequest) => {
      const schema = request.jsonSchema as {
        properties?: Record<string, { type?: string }>;
      };
      // The turn generator asks for `move`; the answer evaluator asks for `score`.
      if (schema.properties && "move" in schema.properties) {
        return JSON.stringify({
          move: "question",
          text: "What is a React hook you reach for most often?",
          topic: "React",
        });
      }
      return JSON.stringify({
        score: 8,
        relevance: 8,
        depth: 7,
        clarity: 9,
        strengths: ["Clear structure"],
        gaps: ["Could add metrics"],
      });
    }),
  } as unknown as LLMClient;
}

function makeClosingLLM(): LLMClient {
  return {
    generateJson: vi.fn(async (request: LLMJsonRequest) => {
      const schema = request.jsonSchema as { properties?: Record<string, { type?: string }> };
      if (schema.properties && "move" in schema.properties) {
        return JSON.stringify({
          move: "closing",
          text: "Thanks for your time, Ada — that's everything from me. Your feedback is on its way.",
          topic: null,
        });
      }
      return JSON.stringify({
        score: 7,
        relevance: 7,
        depth: 6,
        clarity: 8,
        strengths: ["Direct answer"],
        gaps: ["Missing an example"],
      });
    }),
  } as unknown as LLMClient;
}

interface ScenarioOptions {
  readonly status?: string;
  readonly startedAt?: string | null;
  readonly turns?: unknown[];
  readonly existingClosing?: boolean;
}

/** Wires a fake DB for one session, recording every write it receives. */
function scenario(options: ScenarioOptions = {}) {
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const turns = options.turns ?? [];

  const handler: Handler = (table, op, payload) => {
    writes.push({ table, op, payload });

    if (table === "interviews" && op === "select") {
      if (options.status === "missing") return { data: null, error: null };
      return {
        data: {
          user_id: USER_ID,
          status: options.status ?? "in_progress",
          config,
          context_snapshot: context,
          started_at: options.startedAt ?? new Date(Date.now() - 10_000).toISOString(),
          completed_at: null,
        },
        error: null,
      };
    }
    if (table === "interview_turns" && op === "select") {
      return { data: turns, error: null };
    }
    if (table === "interview_turns" && op === "update") {
      // The answer update selects the row it touched; only one row matches.
      return { data: [{ id: "turn-0" }], error: null };
    }
    if (table === "interviews" && op === "update") {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };

  return { supabase: createSupabase(handler), writes };
}

function openSession(options: ScenarioOptions & { llm?: LLMClient } = {}) {
  const { supabase, writes } = scenario(options);
  return {
    writes,
    open: () =>
      InterviewSession.open({
        supabase,
        llm: options.llm ?? makeLLM(),
        userId: USER_ID,
        interviewId: INTERVIEW_ID,
        nowMs: Date.now(),
      }),
  };
}

// ---------------------------------------------------------------- tests

describe("InterviewSession.open", () => {
  it("throws a 404-shaped error for a missing interview", async () => {
    const { open } = openSession({ status: "missing" });
    await expect(open()).rejects.toBeInstanceOf(InterviewError);
    await open().catch((error: InterviewError) => {
      expect(error.code).toBe("interview_not_found");
      expect(error.httpStatus).toBe(404);
    });
  });
});

describe("InterviewSession.start", () => {
  it("generates the greeting, marks the session in progress and keeps it open", async () => {
    const { open, writes } = openSession({ status: "setup", startedAt: null, turns: [] });
    const session = await open();

    const result = await session.start();

    expect(result.completed).toBe(false);
    expect(result.nextQuestion.move).toBe("open");
    expect(result.nextQuestion.isClosing).toBe(false);
    expect(result.nextQuestion.questionText.length).toBeGreaterThan(8);

    const turnInsert = writes.find((write) => write.table === "interview_turns" && write.op === "insert");
    expect(turnInsert).toBeDefined();
    expect((turnInsert?.payload as { turn_index: number }).turn_index).toBe(0);

    const statusUpdate = writes.find((write) => write.table === "interviews" && write.op === "update");
    expect((statusUpdate?.payload as { status: string }).status).toBe("in_progress");
  });

  it("refuses to restart a session that already has turns", async () => {
    const existing = [
      {
        id: "turn-0",
        turn_index: 0,
        question_type: "main",
        question_text: "Tell me about yourself.",
        topic: "introduction",
        answer_text: null,
        evaluation: { move: "open", fallback: false },
      },
    ];
    const { open } = openSession({ turns: existing });
    const session = await open();

    await expect(session.start()).rejects.toMatchObject({ code: "interview_not_started" });
  });
});

describe("InterviewSession.submitAnswer", () => {
  const openingTurn = {
    id: "turn-0",
    turn_index: 0,
    question_type: "main",
    question_text: "Tell me about yourself.",
    topic: "introduction",
    answer_text: null,
    evaluation: { move: "open", fallback: false },
  };

  it("saves the answer and returns the next line while time remains", async () => {
    const { open, writes } = openSession({ turns: [openingTurn] });
    const session = await open();

    const result = await session.submitAnswer("I build dashboards in React.");

    expect(result.completed).toBe(false);
    expect(result.nextQuestion.isClosing).toBe(false);
    expect(result.remainingSeconds).toBeGreaterThan(0);

    const answerUpdate = writes.find(
      (write) => write.table === "interview_turns" && write.op === "update",
    );
    expect((answerUpdate?.payload as { answer_text: string }).answer_text).toBe(
      "I build dashboards in React.",
    );

    const turnInsert = writes.find((write) => write.table === "interview_turns" && write.op === "insert");
    expect(turnInsert).toBeDefined();
    expect((turnInsert?.payload as { turn_index: number }).turn_index).toBe(1);
  });

  it("keeps the answer and closes the conversation when the clock has run out", async () => {
    const startedAt = new Date(Date.now() - 200_000).toISOString(); // 3-minute session, 200s in
    const { open, writes } = openSession({ startedAt, turns: [openingTurn] });
    const session = await open();

    const result = await session.submitAnswer("I build dashboards in React.");

    expect(result.completed).toBe(true);
    expect(result.nextQuestion.isClosing).toBe(true);
    expect(result.phase).toBe("ENDED");
    expect(result.remainingSeconds).toBe(0);

    // The answer was still evaluated and persisted before closing.
    const answerUpdate = writes.find(
      (write) => write.table === "interview_turns" && write.op === "update",
    );
    expect(answerUpdate).toBeDefined();

    const statusUpdate = writes.filter(
      (write) => write.table === "interviews" && write.op === "update",
    );
    expect(statusUpdate.some((write) => (write.payload as { status: string }).status === "completed")).toBe(
      true,
    );
  });

  it("rejects an answer once the interview is completed", async () => {
    const { open } = openSession({ status: "completed", turns: [openingTurn] });
    const session = await open();

    await expect(session.submitAnswer("Anything")).rejects.toMatchObject({
      code: "interview_already_completed",
      httpStatus: 409,
    });
  });

  it("rejects an answer when there is no open question", async () => {
    const answered = { ...openingTurn, answer_text: "Already said this." };
    const { open } = openSession({ turns: [answered] });
    const session = await open();

    await expect(session.submitAnswer("And more")).rejects.toMatchObject({
      code: "interview_not_started",
    });
  });
});

describe("InterviewSession.close", () => {
  const openingTurn = {
    id: "turn-0",
    turn_index: 0,
    question_type: "main",
    question_text: "Tell me about yourself.",
    topic: "introduction",
    answer_text: "I build things.",
    evaluation: { move: "open", fallback: false, score: 7 },
  };

  it("writes a closing line and completes the interview", async () => {
    const { open, writes } = openSession({ llm: makeClosingLLM(), turns: [openingTurn] });
    const session = await open();

    const result = await session.close();

    expect(result.completed).toBe(true);
    expect(result.nextQuestion.isClosing).toBe(true);
    expect(result.nextQuestion.move).toBe("closing");
    expect(result.phase).toBe("ENDED");

    const turnInsert = writes.find((write) => write.table === "interview_turns" && write.op === "insert");
    expect((turnInsert?.payload as { evaluation: Json }).evaluation).toMatchObject({
      move: "closing",
    });

    const statusUpdate = writes.find(
      (write) =>
        write.table === "interviews" &&
        write.op === "update" &&
        (write.payload as { status?: string }).status === "completed",
    );
    expect(statusUpdate).toBeDefined();
    // The score is averaged from the stored evaluations (7 -> 70).
    expect((statusUpdate?.payload as { overall_score: number }).overall_score).toBe(70);
  });

  it("is idempotent: a second close returns the same line without writing", async () => {
    const closingTurn = {
      id: "turn-1",
      turn_index: 1,
      question_type: "followup",
      question_text: "Thanks, Ada — that's all from me.",
      topic: null,
      answer_text: null,
      evaluation: { move: "closing", fallback: false },
    };
    const { open, writes } = openSession({
      status: "completed",
      turns: [openingTurn, closingTurn],
    });
    const session = await open();

    const first = await session.close();
    const second = await session.close();

    expect(first.nextQuestion.questionText).toBe(second.nextQuestion.questionText);
    expect(first.completed).toBe(true);
    expect(writes.filter((write) => write.op === "insert")).toHaveLength(0);
  });
});
