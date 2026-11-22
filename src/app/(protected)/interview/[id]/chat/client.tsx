"use client";

import { z } from "zod";
import { Bot, Mic, MicOff, Send, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { VoiceStage } from "@/components/voice/VoiceStage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useVoiceInterviewLoop } from "@/lib/voice/useVoiceInterviewLoop";
import type { SubmitOutcome } from "@/lib/voice/VoiceInterviewController";
import type { VoiceLoopActions } from "@/lib/voice/useVoiceInterviewLoop";
import { findSpeechRecognitionConstructor } from "@/lib/voice/WebSpeechRecognizer";
import { WRAP_UP_SECONDS, type InterviewType } from "@/lib/validation/interviewSchemas";
import type { InterviewPhase } from "@/services/interview/InterviewTimer";

const FALLBACK_NOTICE = "General question - personalization failed";
const COMPLETION_NOTICE = "Interview complete. Preparing your report...";
const MAX_ANSWER_LENGTH = 3000;
/** Safety net: force the wrap-up if the closing line never reports back. */
const CLOSING_SPEECH_TIMEOUT_MS = (text: string): number =>
  Math.min(60_000, 6_000 + text.length * 100);

const answerResponseSchema = z
  .object({
    status: z.literal("saved"),
    interviewId: z.string(),
    completed: z.boolean(),
    nextQuestion: z
      .object({
        questionText: z.string(),
        topic: z.string().nullable(),
        fallback: z.boolean(),
        isFollowup: z.boolean().optional(),
        isClosing: z.boolean().optional(),
        move: z.string().optional(),
      })
      .nullable(),
    remainingSeconds: z.number().optional(),
    elapsedSeconds: z.number().optional(),
    phase: z.enum(["OPENING", "MAIN", "WRAP_UP", "ENDED"]).optional(),
  })
  .superRefine((result, context) => {
    if (result.completed && result.nextQuestion?.isClosing !== true) {
      context.addIssue({
        code: "custom",
        message: "Completed responses must carry the closing line.",
      });
    }
    if (!result.completed && result.nextQuestion === null) {
      context.addIssue({
        code: "custom",
        message: "Active responses must include the interviewer's next line.",
      });
    }
  });

type AnswerResponse = z.infer<typeof answerResponseSchema>;
type ClosingPayload = NonNullable<AnswerResponse["nextQuestion"]>;

type ChatMessage = {
  id: string;
  text: string;
  isUser: boolean;
  isQuestion?: boolean;
  isFollowup?: boolean;
  isFallback?: boolean;
  isNotice?: boolean;
};

type ChatUIProps = {
  interviewId: string;
  targetRole: string;
  interviewType: InterviewType;
  durationSeconds: number;
  initialRemainingSeconds: number;
  initialPhase: InterviewPhase;
  speechLanguage: string;
};

const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  hr: "HR",
  technical: "Technical",
  mixed: "Mixed",
};

const PHASE_META: Record<InterviewPhase, { label: string; className: string }> = {
  OPENING: { label: "Opening", className: "border-accent/30 bg-accent/10 text-accent" },
  MAIN: { label: "In conversation", className: "border-border bg-surface text-muted-foreground" },
  WRAP_UP: { label: "Wrapping up", className: "border-warning/40 bg-warning/10 text-warning" },
  ENDED: { label: "Complete", className: "border-success/40 bg-success/10 text-success" },
};

/** Loop states where yanking the session would cut the candidate off. */
const VOICE_BUSY_STATES = new Set([
  "hearing",
  "silence_countdown",
  "submitting",
  "speaking",
]);

function formatClock(totalSeconds: number): string {
  const total = Math.max(0, totalSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isFallbackEvaluation(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.questionFallback === true || record.fallback === true;
}

function moveOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const move = (value as Record<string, unknown>).move;
  return typeof move === "string" ? move : null;
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Interview chat UI — time-based, restores turns, asks one line at a time. */
export default function ChatUI({
  interviewId,
  targetRole,
  interviewType,
  durationSeconds,
  initialRemainingSeconds,
  initialPhase,
  speechLanguage,
}: ChatUIProps) {
  const router = useRouter();
  const reportHref = `/interview/${encodeURIComponent(interviewId)}/report`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<"answer" | "end" | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [lastQuestion, setLastQuestion] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);
  const [serverPhase, setServerPhase] = useState<InterviewPhase>(initialPhase);
  const voiceModeRef = useRef(false);
  const answerInputRef = useRef("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cancelEndRef = useRef<HTMLButtonElement>(null);
  const pendingAnswerId = useRef<string | null>(null);
  const wasSubmitting = useRef(false);
  const submittingRef = useRef(false);
  const completedRef = useRef(false);
  const loopActionsRef = useRef<VoiceLoopActions | null>(null);
  /**
   * Deadline based on the server's remaining time, so the tick never drifts.
   * Seeded on the first tick (effects may read the clock; render may not).
   */
  const deadlineRef = useRef<number | null>(null);
  const endingRef = useRef(false);
  const autoEndRef = useRef(false);
  const closingSpeechRef = useRef(false);
  const closingTimerRef = useRef<number | null>(null);

  const updateAnswerInput = useCallback((text: string): void => {
    answerInputRef.current = text;
    setInput(text);
  }, []);

  /** Re-anchors the local countdown on the server's authoritative clock. */
  const syncClock = useCallback((remaining: number): void => {
    const safe = Math.max(0, remaining);
    deadlineRef.current = Date.now() + safe * 1000;
    setRemainingSeconds(safe);
    // Time back on the clock means the buzzer can fire again later.
    if (safe > 0) autoEndRef.current = false;
  }, []);

  const clearClosingTimer = useCallback((): void => {
    if (closingTimerRef.current !== null) {
      window.clearTimeout(closingTimerRef.current);
      closingTimerRef.current = null;
    }
  }, []);

  const markCompleted = useCallback((): void => {
    clearClosingTimer();
    closingSpeechRef.current = false;
    completedRef.current = true;
    loopActionsRef.current?.disable();
    setVoiceMode(false);
    voiceModeRef.current = false;
    setCompleted(true);
    setConfirmEnd(false);
    setRemainingSeconds(0);
    setServerPhase("ENDED");
    setMessages((previous) =>
      previous.some((message) => message.id === "completion")
        ? previous
        : [
            ...previous,
            {
              id: "completion",
              text: COMPLETION_NOTICE,
              isUser: false,
              isNotice: true,
            },
          ],
    );
  }, [clearClosingTimer]);

  /**
   * Shows the closing line and, in voice mode, arms the sequencing that lets
   * the interviewer finish speaking before the session is torn down.
   * Returns true when the caller should hand the line to the voice loop.
   */
  const presentClosingLine = useCallback(
    (closing: ClosingPayload): boolean => {
      syncClock(0);
      setServerPhase("ENDED");
      setLastQuestion(closing.questionText);
      setMessages((previous) =>
        previous.some((message) => message.id === "closing-line")
          ? previous
          : [
              ...previous,
              {
                id: "closing-line",
                text: closing.questionText,
                isUser: false,
                isQuestion: true,
                isFollowup: closing.isFollowup ?? false,
                isFallback: closing.fallback,
              },
            ],
      );

      if (!voiceModeRef.current) {
        markCompleted();
        return false;
      }

      closingSpeechRef.current = true;
      clearClosingTimer();
      closingTimerRef.current = window.setTimeout(() => {
        closingTimerRef.current = null;
        closingSpeechRef.current = false;
        markCompleted();
      }, CLOSING_SPEECH_TIMEOUT_MS(closing.questionText));
      return true;
    },
    [clearClosingTimer, markCompleted, syncClock],
  );

  useEffect(() => {
    (async () => {
      try {
        const supa = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supa.auth.getUser();
        if (!user) return;

        const { data, error } = await supa
          .from("interview_turns")
          .select("*")
          .eq("interview_id", interviewId)
          .order("turn_index", { ascending: true });

        if (error) throw error;

        const builtMessages: ChatMessage[] = [];
        for (const turn of data ?? []) {
          if (turn.question_text) {
            const move = moveOf(turn.evaluation);
            builtMessages.push({
              id: `question-${turn.turn_index}`,
              text: turn.question_text,
              isUser: false,
              isQuestion: true,
              isFollowup: move !== null ? move === "probe" : turn.question_type === "followup",
              isFallback: isFallbackEvaluation(turn.evaluation),
            });
          }
          if (turn.answer_text) {
            builtMessages.push({
              id: `answer-${turn.turn_index}`,
              text: turn.answer_text,
              isUser: true,
            });
          }
        }

        setLastQuestion(
          [...builtMessages].reverse().find((message) => message.isQuestion)?.text ?? "",
        );
        setMessages(builtMessages);
      } catch (error) {
        console.error("Failed to fetch interview turns", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        setErrorMessage("We couldn't load this interview. Please refresh and try again.");
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [interviewId]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, submitting]);

  useEffect(() => {
    if (wasSubmitting.current && !submitting && !completed) {
      textareaRef.current?.focus();
    }
    wasSubmitting.current = submitting;
  }, [submitting, completed]);

  useEffect(() => {
    if (!confirmEnd) return;
    cancelEndRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") setConfirmEnd(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmEnd]);

  useEffect(() => {
    if (!completed) return;
    const timeout = window.setTimeout(() => router.push(reportHref), 1500);
    return () => window.clearTimeout(timeout);
  }, [completed, reportHref, router]);

  // Local countdown, re-anchored whenever the server reports its own clock.
  useEffect(() => {
    if (completed) return;
    const tick = (): void => {
      if (deadlineRef.current === null) {
        deadlineRef.current = Date.now() + initialRemainingSeconds * 1000;
      }
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds((previous) => (previous === left ? previous : left));
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [completed, initialRemainingSeconds]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const applyResultClock = useCallback(
    (result: AnswerResponse): void => {
      if (typeof result.remainingSeconds === "number") syncClock(result.remainingSeconds);
      if (result.phase) setServerPhase(result.phase);
    },
    [syncClock],
  );

  const endInterview = useCallback(async (): Promise<void> => {
    if (submittingRef.current || completedRef.current || endingRef.current) return;
    endingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);
    setErrorAction(null);
    try {
      const response = await fetch(`/api/interview/${encodeURIComponent(interviewId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, action: "end" }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const apiError = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(apiError.success ? apiError.data.error : "We couldn't end this interview.");
      }
      const result = answerResponseSchema.parse(payload);
      if (!result.completed || !result.nextQuestion) {
        throw new Error("The interview could not be completed.");
      }
      setConfirmEnd(false);
      applyResultClock(result);
      const speakInVoice = presentClosingLine(result.nextQuestion);
      if (speakInVoice) loopActionsRef.current?.speak(result.nextQuestion.questionText);
    } catch (error) {
      endingRef.current = false;
      setConfirmEnd(false);
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't end this interview. Please try again.",
      );
      setErrorAction("end");
    } finally {
      setSubmitting(false);
    }
  }, [applyResultClock, interviewId, presentClosingLine]);

  /**
   * The single submission path shared by the text Send button and the voice
   * loop (auto-send, Send now, Retry). Resolves `ignored` for no-op calls and
   * rejects on failure so each caller can surface its own error UI.
   */
  const submitAnswer = useCallback(
    async (rawText: string): Promise<SubmitOutcome> => {
      const answerText = rawText.trim();
      if (
        !answerText ||
        !interviewId ||
        submittingRef.current ||
        completedRef.current ||
        closingSpeechRef.current
      ) {
        return { status: "ignored" };
      }
      submittingRef.current = true;
      const answerId = pendingAnswerId.current ?? createMessageId("answer");
      pendingAnswerId.current = answerId;
      setMessages((previous) => {
        const hasPendingAnswer = previous.some((message) => message.id === answerId);
        if (hasPendingAnswer) {
          return previous.map((message) =>
            message.id === answerId ? { ...message, text: answerText } : message,
          );
        }
        return [...previous, { id: answerId, text: answerText, isUser: true }];
      });
      setSubmitting(true);
      setErrorMessage(null);
      setErrorAction(null);
      try {
        const response = await fetch(`/api/interview/${encodeURIComponent(interviewId)}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId, answer_text: answerText }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const apiError = z.object({ error: z.string() }).safeParse(payload);
          throw new Error(
            apiError.success ? apiError.data.error : "We couldn't submit that answer.",
          );
        }

        const result = answerResponseSchema.parse(payload);
        pendingAnswerId.current = null;
        updateAnswerInput("");
        applyResultClock(result);

        if (result.completed && result.nextQuestion) {
          const speakInVoice = presentClosingLine(result.nextQuestion);
          // The voice loop speaks the closing line itself from `nextQuestion`.
          return speakInVoice
            ? { status: "next", questionText: result.nextQuestion.questionText }
            : { status: "completed" };
        }

        const nextQuestion = result.nextQuestion;
        if (nextQuestion) {
          setLastQuestion(nextQuestion.questionText);
          setMessages((previous) => [
            ...previous,
            {
              id: createMessageId("question"),
              text: nextQuestion.questionText,
              isUser: false,
              isQuestion: true,
              isFollowup: nextQuestion.isFollowup ?? false,
              isFallback: nextQuestion.fallback,
            },
          ]);
          return { status: "next", questionText: nextQuestion.questionText };
        }
        markCompleted();
        return { status: "completed" };
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [applyResultClock, interviewId, markCompleted, presentClosingLine, updateAnswerInput],
  );

  const voiceLoop = useVoiceInterviewLoop({ language: speechLanguage, submit: submitAnswer });
  useEffect(() => {
    loopActionsRef.current = voiceLoop.actions;
  }, [voiceLoop.actions]);

  // The buzzer: ends the session once nothing is in flight, never mid-answer.
  // A half-typed answer is submitted first so it is evaluated and kept.
  const voiceState = voiceLoop.snapshot.state;
  const voiceBusy = voiceMode && VOICE_BUSY_STATES.has(voiceState);
  useEffect(() => {
    if (completed || loadingInitial) return;
    if (remainingSeconds > 0 || submitting || voiceBusy) return;
    if (closingSpeechRef.current || autoEndRef.current) return;
    autoEndRef.current = true;
    const draft = answerInputRef.current.trim();
    if (draft !== "" && !voiceModeRef.current) {
      void submitAnswer(draft).catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We couldn't submit that answer. Please try again.",
        );
        setErrorAction("answer");
      });
      return;
    }
    void endInterview();
  }, [
    completed,
    endInterview,
    loadingInitial,
    remainingSeconds,
    submitAnswer,
    submitting,
    voiceBusy,
  ]);

  // Once the closing line has been handed to the voice loop, wrap up as soon
  // as it stops being spoken (with a timeout in case TTS never reports back).
  // Deferred a tick so the final render lands before the session is torn down.
  useEffect(() => {
    if (!closingSpeechRef.current) return;
    if (voiceState === "submitting" || voiceState === "speaking") return;
    const timeout = window.setTimeout(() => {
      if (!closingSpeechRef.current) return;
      clearClosingTimer();
      closingSpeechRef.current = false;
      markCompleted();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [clearClosingTimer, markCompleted, voiceState]);

  const toggleVoiceMode = (): void => {
    const enabled = !voiceModeRef.current;
    voiceModeRef.current = enabled;
    setVoiceMode(enabled);
    if (enabled) {
      setSttSupported(findSpeechRecognitionConstructor(window) !== null);
      voiceLoop.actions.enable({ question: lastQuestion, seedTranscript: input });
      return;
    }
    const transcript = voiceLoop.snapshot.transcript;
    if (transcript.trim() !== "") {
      updateAnswerInput(transcript.slice(0, MAX_ANSWER_LENGTH));
    }
    voiceLoop.actions.disable();
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try {
      await submitAnswer(answerInputRef.current);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't submit that answer. Please try again.",
      );
      setErrorAction("answer");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const displayPhase: InterviewPhase = completed
    ? "ENDED"
    : remainingSeconds <= 0
      ? "ENDED"
      : remainingSeconds <= WRAP_UP_SECONDS
        ? "WRAP_UP"
        : serverPhase === "ENDED"
          ? "MAIN"
          : serverPhase;
  const elapsedSeconds = Math.max(0, durationSeconds - remainingSeconds);
  const progress = durationSeconds > 0 ? (elapsedSeconds / durationSeconds) * 100 : 0;
  const phaseMeta = PHASE_META[displayPhase];

  return (
    <main className="h-[100dvh] min-h-0 overflow-hidden bg-background px-3 py-3 sm:px-6 sm:py-5">
      <Card className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-3xl p-4 sm:p-7">
        <header className="shrink-0 border-b border-border/80 pb-4 sm:pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-white shadow-[0_8px_24px_-10px_var(--glow)]">
                <Bot aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {targetRole}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {INTERVIEW_TYPE_LABELS[interviewType]} interview
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting || completed || loadingInitial}
              onClick={() => setConfirmEnd(true)}
              className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground backdrop-blur-xl transition-all hover:border-accent/40 hover:bg-surface-strong disabled:pointer-events-none disabled:opacity-60 sm:px-4 sm:text-sm"
            >
              End interview
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${phaseMeta.className}`}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                {phaseMeta.label}
              </span>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  remainingSeconds <= WRAP_UP_SECONDS && !completed ? "text-warning" : "text-foreground"
                }`}
              >
                {formatClock(remainingSeconds)} left
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submitting || completed || loadingInitial}
                aria-pressed={voiceMode}
                onClick={toggleVoiceMode}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 ${
                  voiceMode
                    ? "border-accent/40 bg-accent/15 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-strong"
                }`}
              >
                {voiceMode ? (
                  <Mic aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <MicOff aria-hidden="true" className="h-4 w-4" />
                )}
                Voice mode
              </button>
              <span className="text-[11px] text-muted-foreground">
                {completed ? "Complete" : "In progress"}
              </span>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label="Interview time elapsed"
            aria-valuemin={0}
            aria-valuemax={durationSeconds}
            aria-valuenow={elapsedSeconds}
            className="mt-2 h-1 overflow-hidden rounded-full bg-surface-strong"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {!sttSupported && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Voice input works best in Chrome, Edge or Safari. You can still type.
            </p>
          )}
        </header>

        {voiceMode && !completed && !loadingInitial ? (
          <VoiceStage
            questionText={
              lastQuestion || "Your first question will appear here as soon as it is ready."
            }
            remainingSeconds={remainingSeconds}
            history={messages}
            snapshot={voiceLoop.snapshot}
            settings={voiceLoop.settings}
            onSettingsChange={voiceLoop.patchSettings}
            actions={voiceLoop.actions}
            shortcutsActive={!confirmEnd}
            onExit={toggleVoiceMode}
          />
        ) : (
        <div className="flex min-h-0 flex-1 flex-col pt-3 lg:pt-5">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              ref={messagesRef}
              role="log"
              aria-label="Interview messages"
              aria-live="polite"
              aria-relevant="additions text"
              tabIndex={0}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-1 py-3 sm:px-2 sm:py-5"
            >
              {loadingInitial && (
                <p className="text-sm text-muted-foreground">Loading your interview…</p>
              )}
              {!loadingInitial && messages.length === 0 && !errorMessage && (
                <p className="text-center text-sm text-muted-foreground">
                  Your first question will appear here.
                </p>
              )}
              {messages.map((message) =>
                message.isNotice ? (
                  <div
                    key={message.id}
                    role="status"
                    className="mx-auto w-fit max-w-full rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-center text-sm text-foreground"
                  >
                    {message.text}
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className={`flex min-w-0 items-start gap-2.5 ${
                      message.isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!message.isUser && (
                      <span
                        aria-hidden="true"
                        className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent"
                      >
                        <Bot className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 max-w-[80%]">
                      <div
                        className={
                          message.isUser
                            ? "min-w-0 rounded-2xl rounded-br-md bg-gradient-to-br from-accent via-accent-2 to-accent-2 px-4 py-3 text-sm leading-relaxed text-white shadow-[0_10px_28px_-16px_var(--glow)] break-words [overflow-wrap:anywhere]"
                            : "min-w-0 rounded-2xl rounded-bl-md border border-border bg-surface-strong px-4 py-3 text-sm leading-relaxed text-foreground break-words [overflow-wrap:anywhere]"
                        }
                      >
                        <p className="whitespace-pre-wrap">{message.text}</p>
                      </div>
                      {(message.isQuestion && (message.isFallback || message.isFollowup)) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
                          {message.isFollowup && (
                            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-accent">
                              Follow-up
                            </span>
                          )}
                          {message.isFallback && <span>{FALLBACK_NOTICE}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
              {submitting && !completed && (
                <div className="flex min-w-0 items-center gap-2.5" aria-label="AI is typing">
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/10 text-accent"
                  >
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface-strong px-4 py-3">
                    <span className="sr-only">AI is typing</span>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                  </div>
                </div>
              )}
              <div aria-hidden="true" />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground"
              >
                <p className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{errorMessage}</p>
                {errorAction && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      if (errorAction === "end") void endInterview();
                      else formRef.current?.requestSubmit();
                    }}
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-60"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {completed ? (
              <div className="flex shrink-0 flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{COMPLETION_NOTICE}</p>
                <Button href={reportHref} size="sm" className="w-full sm:w-auto">
                  View report
                </Button>
              </div>
            ) : (
              <form
                ref={formRef}
                className="shrink-0 border-t border-border/80 pt-4"
                onSubmit={sendMessage}
              >
                <div className="flex min-w-0 items-end gap-2 rounded-2xl border border-border bg-surface-strong p-2 focus-within:border-accent/50">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => {
                      const text = event.target.value.slice(0, MAX_ANSWER_LENGTH);
                      updateAnswerInput(text);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your answer… (Enter to send, Shift+Enter for a new line)"
                    disabled={submitting || loadingInitial}
                    maxLength={MAX_ANSWER_LENGTH}
                    rows={1}
                    aria-label="Your answer"
                    className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || loadingInitial || !input.trim()}
                    className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-4"
                    aria-label="Send answer"
                  >
                    <Send aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
                  <span>{submitting ? "Waiting for your next question…" : "Your answer is private."}</span>
                  <span aria-live="polite">
                    {input.length}/{MAX_ANSWER_LENGTH}
                  </span>
                </div>
              </form>
            )}
          </section>
        </div>
        )}
      </Card>

      {confirmEnd && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmEnd(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-interview-title"
            aria-describedby="end-interview-description"
            className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="end-interview-title" className="font-display text-lg font-semibold text-foreground">
                  End this interview?
                </h2>
                <p id="end-interview-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  You can’t return to the questions after ending it. Your report will be prepared.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close confirmation"
                onClick={() => setConfirmEnd(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-strong hover:text-foreground"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                ref={cancelEndRef}
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground backdrop-blur-xl transition-all duration-200 hover:border-accent/40 hover:bg-surface-strong"
              >
                Keep going
              </button>
              <Button
                type="button"
                size="sm"
                disabled={submitting}
                onClick={() => void endInterview()}
              >
                End interview
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
