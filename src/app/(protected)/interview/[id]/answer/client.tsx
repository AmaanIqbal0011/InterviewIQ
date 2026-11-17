"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Interview answer submission page. */
export default function AnswerClient() {
  const router = useRouter();
  const [user, setUser] = useState<boolean>(false);
  const [interviewId] = useState<string>("interview-1");
  const [answerText, setAnswerText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    void (async () => {
      const sup = createSupabaseBrowserClient();
      const { data } = await sup.auth.getUser();
      setUser(!!data?.user);
    })();
  }, []);

  if (!user) {
    router.push("/login");
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const sup = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await sup.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // TODO: Submit answer to API
      // In a full impl, this would call the answer submission endpoint
      // with auth check, ownership check, length limit (3000 chars), etc.
      router.push(`/interview/${interviewId}`);
    } catch (err) {
      console.error("Answer submit error", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 max-w-xl">
      <h2 className="font-display text-xl font-semibold text-foreground mb-4">
        Answer Question
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" value={interviewId} id="interview-id" />
        <div>
          <textarea
            placeholder="Your answer (max 3000 characters)"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            maxLength={3000}
            className="w-full rounded border border-border p-2 text-sm resize-none"
            rows={4}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            Submit Answer
          </Button>
          <Button type="button" onClick={() => router.back()} disabled={submitting}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Cancel
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Maximum 3000 characters. Your answer will be evaluated by the AI interviewer.
        </p>
      </form>
    </Card>
  );
}
