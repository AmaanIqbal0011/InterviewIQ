"use client";

import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createInterviewAction } from "@/app/(protected)/interview/actions";
import { durationValues, type InterviewDuration } from "@/lib/validation/interviewSchemas";

export default function NewInterviewForm() {
  const [user, setUser] = useState<boolean>(false);
  const [duration, setDuration] = useState<InterviewDuration>("5");

  // Check auth state
  useEffect(() => {
    ;(async () => {
      const sup = createSupabaseBrowserClient();
      const { data } = await sup.auth.getUser();
      setUser(!!data?.user);
    })();
  }, []);

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = createSupabaseBrowserClient();
    const { data: { user } } = await sup.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Build raw config from form values
    const formData = new FormData(e.target as HTMLFormElement);
    const rawTopicString = formData.get("focus_topics") as string || "";
    const focusTopics = rawTopicString
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 8);
    const rawConfig = {
      target_role: formData.get("target_role") as string || "",
      experience_level: formData.get("experience_level") as string || "mid",
      interview_type: formData.get("interview_type") as string || "technical",
      difficulty: (formData.get("difficulty") as string) || "medium",
      duration_minutes: duration,
      interview_language: formData.get("interview_language") as string || "english",
      use_resume: formData.get("use_resume") ? formData.get("use_resume") === "on" : false,
      focus_topics: focusTopics,
    };

    // Call createInterviewAction with form values
    const result = await createInterviewAction(rawConfig);

    if (result.ok) {
      window.location.href = `/interview/${result.interviewId}/chat`;
    } else {
      alert(result.message || "We couldn't start that interview. Please try again.");
    }
  };

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="space-y-6">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            New Interview
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Set up your session
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Sign in to create your interview session.
          </p>
          <Button href="/login" variant="primary">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            New Interview
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Set up your session
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pick a role, adjust the difficulty, and start talking to your AI interviewer.
          </p>
        </div>

        <Card className="p-6 sm:p-8 max-w-2xl">
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            New Interview
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Target Role
              </label>
              <input
                type="text"
                placeholder="e.g. Software Engineer"
                name="target_role"
                className="w-full rounded border border-border p-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Experience Level
              </label>
              <select
                name="experience_level"
                className="w-full rounded border border-border p-2 text-sm"
              >
                <option value="entry">Entry</option>
                <option value="junior">Junior</option>
                <option value="mid" defaultChecked>
                  Mid
                </option>
                <option value="senior">Senior</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Interview Type
              </label>
              <select
                name="interview_type"
                className="w-full rounded border border-border p-2 text-sm"
              >
                <option value="hr">HR</option>
                <option value="technical" defaultChecked>
                  Technical
                </option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Difficulty
              </label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <input type="radio" name="difficulty" value="easy" className="rounded" /> Easy
                </label>
                <label className="flex-1">
                  <input type="radio" name="difficulty" value="medium" defaultChecked className="rounded" /> Medium
                </label>
                <label className="flex-1">
                  <input type="radio" name="difficulty" value="hard" className="rounded" /> Hard
                </label>
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-foreground mb-2">
                Interview length
              </span>
              <div
                role="radiogroup"
                aria-label="Interview length"
                className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-surface-strong p-1.5"
              >
                {durationValues.map((value) => {
                  const selected = duration === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDuration(value)}
                      className={`rounded-xl px-2 py-2.5 text-center text-sm font-semibold transition-all ${
                        selected
                          ? "bg-gradient-to-br from-accent via-accent-2 to-accent-3 text-white shadow-[0_8px_20px_-12px_var(--glow)]"
                          : "text-muted-foreground hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      {value} min
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                The interviewer keeps to the clock — you&apos;ll wrap up in the last 45 seconds.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Interview Language
              </label>
              <select
                name="interview_language"
                className="w-full rounded border border-border p-2 text-sm"
              >
                <option value="english">English</option>
                <option value="urdu_hinglish">Urdu / Hinglish</option>
              </select>
            </div>

            <p className="text-sm text-muted-foreground">
              Focus topics (optional, up to 8, under 60 chars each)
            </p>
            <input
              type="text"
              name="focus_topics"
              placeholder="e.g. React, TypeScript"
              className="w-full rounded border border-border p-2 text-sm"
            />

            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" name="use_resume" className="rounded" /> Use my resume for personalization
            </label>
            {true && (
              <p className="mt-1 text-xs text-muted-foreground">
                No completed resume found.{" "}
                <a
                  href="/dashboard"
                  className="underline text-accent hover:text-accent-foreground"
                >
                  Upload a resume from the dashboard
                </a>
              </p>
            )}

            <Button type="submit" className="w-full">
              Start Interview
            </Button>
          </form>
        </Card>

        {/* What your interviewer knows about you panel */}
        <Card className="mt-6 p-6 max-w-2xl">
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">
            What your interviewer knows about you
          </h3>
          <p className="text-sm text-muted-foreground">
            Your interviewer will know your onboarding answers (full name, current status,
            education, skills, interview language, practice goals, and career goals).
            If you have a completed resume, they will also see a summary
            of your resume including skills, experience, education, projects, and
            certifications.
          </p>
          {true && (
            <p className="mt-3 text-sm text-warning">
              Your interviewer will only know your onboarding answers.
            </p>
          )}
        </Card>

        <div className="flex items-center justify-end">
          <Button
            href="/dashboard"
            variant="secondary"
            className="w-auto"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}