import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import ChatUI from "./client";
import { AuthGuard } from "@/guards/AuthGuard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { interviewConfigSchema } from "@/lib/validation/interviewSchemas";

export const metadata: Metadata = {
  title: "Interview Chat",
  robots: { index: false, follow: false },
};

type ChatPageProps = {
  params: Promise<{ id: string }>;
};

function ChatFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Loading your interview…</p>
    </div>
  );
}

export default function ChatPage({ params }: ChatPageProps) {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatContent params={params} />
    </Suspense>
  );
}

async function ChatContent({ params }: ChatPageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const user = await new AuthGuard(supabase).requireUser();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("user_id, status, config")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!interview) notFound();
  if (interview.status === "completed") redirect(`/interview/${encodeURIComponent(id)}/report`);

  const config = interviewConfigSchema.parse(interview.config);

  return (
    <ChatUI
      interviewId={id}
      targetRole={config.target_role}
      interviewType={config.interview_type}
      questionCount={Number(config.question_count)}
      speechLanguage={config.interview_language === "urdu_hinglish" ? "ur-PK" : "en-US"}
    />
  );
}
