"use client";

import { z } from "zod";
import { Bot, Mic, MicOff, RotateCcw, Send, Volume2, VolumeX, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AvatarController } from "@/lib/avatar/AvatarController";
import { WebSpeechLipSync } from "@/lib/avatar/WebSpeechLipSync";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useVoiceInterview } from "@/lib/voice/useVoiceInterview";
import type { InterviewType } from "@/lib/validation/interviewSchemas";

const FALLBACK_NOTICE = "General question - personalization failed";
const COMPLETION_NOTICE = "Interview complete. Preparing your report...";
const MAX_ANSWER_LENGTH = 3000;
const AVATAR_PREFERENCE_KEY = "interviewiq-avatar-enabled";
const avatarPreferenceListeners = new Set<() => void>();
let avatarPreferenceSnapshot: boolean | null = null;
let avatarPreferenceWarningShown = false;

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
      })
      .nullable(),
  })
  .superRefine((result, context) => {
    if (result.completed !== (result.nextQuestion === null)) {
      context.addIssue({
        code: "custom",
        message: "Completion responses must not include a next question.",
      });
    }
  });

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
  questionCount: number;
  speechLanguage: string;
  interviewerName?: string;
};

const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  hr: "HR",
  technical: "Technical",
  mixed: "Mixed",
};

function isFallbackEvaluation(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "fallback" in value &&
    value.fallback === true
  );
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function warnAvatarPreference(error: unknown, action: "read" | "save"): void {
  if (avatarPreferenceWarningShown) return;
  avatarPreferenceWarningShown = true;
  console.warn(`Could not ${action} the avatar display preference`, {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

function getAvatarPreferenceSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  if (avatarPreferenceSnapshot !== null) return avatarPreferenceSnapshot;
  try {
    avatarPreferenceSnapshot = window.localStorage.getItem(AVATAR_PREFERENCE_KEY) !== "false";
  } catch (error) {
    warnAvatarPreference(error, "read");
    avatarPreferenceSnapshot = true;
  }
  return avatarPreferenceSnapshot;
}

function getServerAvatarPreferenceSnapshot(): boolean {
  return true;
}

function subscribeAvatarPreference(listener: () => void): () => void {
  avatarPreferenceListeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== AVATAR_PREFERENCE_KEY && event.key !== null) return;
    avatarPreferenceSnapshot = event.newValue !== "false";
    avatarPreferenceListeners.forEach((notify) => notify());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    avatarPreferenceListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setAvatarPreference(enabled: boolean): void {
  avatarPreferenceSnapshot = enabled;
  try {
    window.localStorage.setItem(AVATAR_PREFERENCE_KEY, String(enabled));
  } catch (error) {
    warnAvatarPreference(error, "save");
  }
  avatarPreferenceListeners.forEach((listener) => listener());
}

/** Interview chat UI - restores turns and requests each next question after an answer. */
export default function ChatUI({
  interviewId,
  targetRole,
  interviewType,
  questionCount,
  speechLanguage,
  interviewerName = "Alex",
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
  const [aiVoiceMuted, setAiVoiceMuted] = useState(false);
  const [speechRate, setSpeechRate] = useState("1");
  const [lastQuestion, setLastQuestion] = useState("");
  const avatarEnabled = useSyncExternalStore(
    subscribeAvatarPreference,
    getAvatarPreferenceSnapshot,
    getServerAvatarPreferenceSnapshot,
  );
  const voiceModeRef = useRef(false);
  const aiVoiceMutedRef = useRef(false);
  const answerInputRef = useRef("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cancelEndRef = useRef<HTMLButtonElement>(null);
  const pendingAnswerId = useRef<string | null>(null);
  const wasSubmitting = useRef(false);

  const updateAnswerInput = useCallback((text: string): void => {
    answerInputRef.current = text;
    setInput(text);
  }, []);
  const voice = useVoiceInterview(speechLanguage, updateAnswerInput);
  const lipSync = useMemo(() => new WebSpeechLipSync(), []);
  const avatarController = useMemo(
    () =>
      new AvatarController(
        {
          subscribeState: voice.subscribeVoiceState,
          subscribeSpeechBoundary: voice.subscribeSpeechBoundary,
        },
        lipSync,
      ),
    [lipSync, voice.subscribeSpeechBoundary, voice.subscribeVoiceState],
  );
  const avatar = useSyncExternalStore(
    avatarController.subscribe,
    avatarController.getSnapshot,
    avatarController.getServerSnapshot,
  );

  useEffect(() => {
    avatarController.connect();
    return () => avatarController.disconnect();
  }, [avatarController]);

  useEffect(() => {
    avatarController.setWaitingForResponse(submitting && !completed);
  }, [avatarController, completed, submitting]);

  useEffect(() => {
    avatarController.setEnabled(avatarEnabled);
  }, [avatarController, avatarEnabled]);

  const toggleAvatar = (): void => {
    setAvatarPreference(!avatarEnabled);
  };

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
            builtMessages.push({
              id: `question-${turn.turn_index}`,
              text: turn.question_text,
              isUser: false,
              isQuestion: true,
              isFollowup: turn.question_type === "followup",
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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const markCompleted = (): void => {
    voice.stop();
    setCompleted(true);
    setConfirmEnd(false);
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
  };

  const endInterview = async (): Promise<void> => {
    if (submitting || completed) return;
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
      if (!result.completed) throw new Error("The interview could not be completed.");
      markCompleted();
    } catch (error) {
      setConfirmEnd(false);
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't end this interview. Please try again.",
      );
      setErrorAction("end");
    } finally {
      setSubmitting(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const answerText = answerInputRef.current.trim();
    if (!answerText || !interviewId || submitting || completed) return;

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
    if (voiceModeRef.current) voice.beginProcessing();
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
        throw new Error(apiError.success ? apiError.data.error : "We couldn't submit that answer.");
      }

      const result = answerResponseSchema.parse(payload);
      pendingAnswerId.current = null;
      updateAnswerInput("");
      const nextQuestion = result.nextQuestion;
      if (nextQuestion) {
        setLastQuestion(nextQuestion.questionText);
        voice.finishProcessing();
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
        if (voiceModeRef.current && !aiVoiceMutedRef.current) {
          voice.speak(nextQuestion.questionText);
        }
      } else {
        markCompleted();
      }
    } catch (error) {
      voice.finishProcessing();
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't submit that answer. Please try again.",
      );
      setErrorAction("answer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const mainQuestionCount = messages.filter(
    (message) => message.isQuestion && !message.isFollowup,
  ).length;
  const currentQuestion = Math.min(questionCount, Math.max(1, mainQuestionCount));
  const progress = (currentQuestion / questionCount) * 100;

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

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              Question {currentQuestion} of {questionCount}
            </p>
            <span className="text-[11px] text-muted-foreground">
              {completed ? "Complete" : "In progress"}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Interview progress"
            aria-valuemin={0}
            aria-valuemax={questionCount}
            aria-valuenow={currentQuestion}
            className="mt-2 h-1 overflow-hidden rounded-full bg-surface-strong"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {(voice.recognitionSupported || voice.synthesisSupported) && (
            <section
              aria-label="Voice controls"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-strong px-3 py-2.5"
            >
              <button
                type="button"
                aria-pressed={voiceMode}
                onClick={() => {
                  const enabled = !voiceModeRef.current;
                  voiceModeRef.current = enabled;
                  setVoiceMode(enabled);
                  if (!enabled) voice.stop();
                  else if (lastQuestion && !aiVoiceMutedRef.current) voice.speak(lastQuestion);
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  voiceMode
                    ? "border-accent/40 bg-accent/15 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:bg-surface-strong"
                }`}
              >
                {voiceMode ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                Voice mode
              </button>

              {voiceMode && (
                <div className="flex flex-wrap items-center gap-2">
                  {voice.state === "speaking" && (
                    <span role="status" className="text-xs font-medium text-accent">
                      AI is speaking...
                    </span>
                  )}
                  {voice.synthesisSupported && (
                    <>
                      <button
                        type="button"
                        aria-pressed={aiVoiceMuted}
                        onClick={() => {
                          const muted = !aiVoiceMutedRef.current;
                          aiVoiceMutedRef.current = muted;
                          setAiVoiceMuted(muted);
                          if (muted) voice.cancelSpeech();
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-foreground hover:bg-surface"
                      >
                        {aiVoiceMuted ? (
                          <VolumeX aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <Volume2 aria-hidden="true" className="h-4 w-4" />
                        )}
                        {aiVoiceMuted ? "AI voice muted" : "Mute AI voice"}
                      </button>
                      <button
                        type="button"
                        disabled={!lastQuestion || aiVoiceMuted}
                        onClick={() => voice.speak(lastQuestion)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-foreground hover:bg-surface disabled:pointer-events-none disabled:opacity-50"
                      >
                        <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                        Replay last question
                      </button>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Speed
                        <select
                          aria-label="Speaking speed"
                          value={speechRate}
                          onChange={(event) => {
                            setSpeechRate(event.target.value);
                            voice.setRate(Number(event.target.value));
                          }}
                          className="h-9 rounded-full border border-border bg-background px-2 text-xs text-foreground"
                        >
                          <option value="0.8">0.8x</option>
                          <option value="1">1x</option>
                          <option value="1.2">1.2x</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
              {voiceMode && (
                <p className="basis-full text-[11px] text-muted-foreground">
                  Recognition accuracy varies by language.
                </p>
              )}
              {voice.recognitionSupported && (
                <p className="basis-full text-[11px] text-muted-foreground">
                  In Chrome, voice recognition is processed by the browser&apos;s speech service. Your
                  text answer is what gets saved.
                </p>
              )}
              {voice.notice && (
                <p role="status" className="basis-full text-[11px] text-muted-foreground">
                  {voice.notice}
                </p>
              )}
            </section>
          )}
          {!voice.recognitionSupported && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Voice input works best in Chrome or Edge. You can still type.
            </p>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 pt-3 lg:flex-row lg:gap-6 lg:pt-5">
          <aside className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 pb-3 lg:w-64 lg:flex-col lg:justify-start lg:gap-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
            {avatarEnabled ? (
              <AvatarRenderer
                state={avatar.state}
                mouthOpenness={avatar.mouthOpenness}
                name={interviewerName}
                caption={lastQuestion}
              />
            ) : (
              <p className="text-xs text-muted-foreground" role="status">
                Avatar hidden
              </p>
            )}
            <button
              type="button"
              aria-pressed={avatarEnabled}
              onClick={toggleAvatar}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-surface px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
            >
              Avatar {avatarEnabled ? "on" : "off"}
            </button>
          </aside>

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
                      voice.updateDraft(text);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your answer… (Enter to send, Shift+Enter for a new line)"
                    disabled={submitting || loadingInitial}
                    maxLength={MAX_ANSWER_LENGTH}
                    rows={1}
                    aria-label="Your answer"
                    className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  {voiceMode && voice.recognitionSupported && (
                    <button
                      type="button"
                      disabled={submitting || loadingInitial}
                      aria-label={voice.state === "listening" ? "Stop and send answer" : "Start recording answer"}
                      onClick={() => {
                        if (voice.state === "listening") {
                          updateAnswerInput(voice.transcript);
                          voice.stopListening();
                          formRef.current?.requestSubmit();
                        } else {
                          voice.startListening(answerInputRef.current);
                        }
                      }}
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors disabled:pointer-events-none disabled:opacity-60 ${
                        voice.state === "listening"
                          ? "animate-pulse bg-red-600 shadow-[0_0_0_6px_rgba(220,38,38,0.15)]"
                          : "bg-accent hover:brightness-110"
                      }`}
                      title={voice.state === "listening" ? "Stop and send" : "Start recording"}
                    >
                      {voice.state === "listening" ? (
                        <Send aria-hidden="true" className="h-5 w-5" />
                      ) : (
                        <Mic aria-hidden="true" className="h-5 w-5" />
                      )}
                    </button>
                  )}
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
