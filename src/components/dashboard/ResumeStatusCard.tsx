"use client";

import { useRef, type ChangeEvent } from "react";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import type { ResumeInfo } from "@/models/ResumeInfo";
import { RESUME_FILE_ACCEPT, formatFileSize } from "@/lib/resume/constants";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useResumeCard, type ResumeCardStatus } from "./useResumeCard";

interface ResumeStatusCardProps {
  resume: ResumeInfo;
}

interface StatusPresentation {
  readonly badge: string;
  readonly badgeClass: string;
  readonly description: string;
  readonly icon: typeof FileText;
}

const STATUS_PRESENTATION: Record<ResumeCardStatus, StatusPresentation> = {
  not_uploaded: {
    badge: "Not uploaded",
    badgeClass: "border-border bg-surface text-muted-foreground",
    description:
      "Upload your resume to unlock questions tailored to your actual experience.",
    icon: Upload,
  },
  uploading: {
    badge: "Uploading",
    badgeClass: "border-accent/40 bg-accent/10 text-accent",
    description: "Uploading your resume — keep this tab open for a moment.",
    icon: Upload,
  },
  pending: {
    badge: "Queued",
    badgeClass: "border-warning/40 bg-warning/10 text-warning",
    description: "Your resume is queued for analysis.",
    icon: Clock,
  },
  processing: {
    badge: "Processing",
    badgeClass: "border-warning/40 bg-warning/10 text-warning",
    description: "We're reading your resume — this usually takes a few seconds.",
    icon: Clock,
  },
  ready: {
    badge: "Ready",
    badgeClass: "border-success/40 bg-success/10 text-success",
    description: "Your resume is parsed and will shape every interview question.",
    icon: CheckCircle2,
  },
  failed: {
    badge: "Failed",
    badgeClass: "border-warning/40 bg-warning/10 text-warning",
    description: "We couldn't finish reading your resume.",
    icon: AlertCircle,
  },
};

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function FileSummary({ fileName, size }: { fileName: string; size: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      <p className="truncate text-xs font-medium text-foreground" title={fileName}>
        {fileName}
      </p>
      {size ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatFileSize(size)}
        </span>
      ) : null}
    </div>
  );
}

function HighlightRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
      <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{label}: </span>
        <span className="break-words">{value}</span>
      </p>
    </div>
  );
}

export function ResumeStatusCard({ resume }: ResumeStatusCardProps) {
  const {
    info,
    status,
    progress,
    activeFileName,
    error,
    isDragging,
    isBusy,
    uploadFile,
    retry,
    dragHandlers,
  } = useResumeCard(resume);

  const inputRef = useRef<HTMLInputElement>(null);
  const presentation = STATUS_PRESENTATION[status];
  const StatusIcon = presentation.icon;
  const hasResume = info.resumeId !== null;
  const showsUploader = status === "not_uploaded" || (status === "failed" && !hasResume);

  const openPicker = () => {
    if (!isBusy) inputRef.current?.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.item(0);
    event.target.value = "";
    if (file) void uploadFile(file);
  };

  return (
    <Card className="flex h-full min-h-[25rem] flex-col gap-4 p-5 sm:p-6">
      <input
        ref={inputRef}
        type="file"
        accept={RESUME_FILE_ACCEPT}
        className="hidden"
        onChange={handleInputChange}
        tabIndex={-1}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-strong text-accent"
          >
            <FileText className="h-4 w-4" />
          </span>
          <h2 className="font-display text-sm font-semibold text-foreground">Your Resume</h2>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            presentation.badgeClass,
          )}
        >
          <StatusIcon aria-hidden="true" className="h-3 w-3" />
          {presentation.badge}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {presentation.description}
      </p>

      <div aria-live="polite" className="flex flex-1 flex-col gap-3">
        {showsUploader ? (
          <>
            <div
              role="button"
              tabIndex={isBusy ? -1 : 0}
              aria-label="Drag and drop your resume here, or press Enter to choose a file"
              aria-describedby="resume-hint"
              aria-disabled={isBusy}
              onClick={openPicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPicker();
                }
              }}
              {...dragHandlers}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors",
                isDragging
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface hover:border-accent/50 hover:bg-surface-strong",
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-strong text-accent">
                <Upload aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-foreground">
                Drag &amp; drop your resume
              </span>
              <span id="resume-hint" className="text-xs text-muted-foreground">
                PDF or DOCX · up to 5 MB
              </span>
            </div>

            <Button size="sm" onClick={openPicker} disabled={isBusy}>
              <Upload aria-hidden="true" className="h-3.5 w-3.5" />
              {status === "failed" ? "Retry upload" : "Upload resume"}
            </Button>

            {error ? <ErrorNote message={error} /> : null}
          </>
        ) : null}

        {status === "uploading" ? (
          <>
            <FileSummary fileName={activeFileName ?? "Your resume"} size={null} />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Uploading</span>
                <span>{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Resume upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-accent-3 transition-[width] duration-300"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
            </div>
          </>
        ) : null}

        {status === "pending" || status === "processing" ? (
          <>
            {info.fileName ? (
              <FileSummary fileName={info.fileName} size={info.size} />
            ) : null}
            <div className="space-y-2.5" role="status" aria-label="Parsing resume">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="h-3.5 w-3.5 text-accent" />
                Reading your experience, skills, and education…
              </div>
              <div aria-hidden="true" className="space-y-1.5">
                <div className="h-2.5 w-11/12 animate-pulse rounded bg-foreground/10" />
                <div className="h-2.5 w-3/4 animate-pulse rounded bg-foreground/10" />
                <div className="h-2.5 w-2/3 animate-pulse rounded bg-foreground/10" />
              </div>
            </div>
          </>
        ) : null}

        {status === "ready" ? (
          <>
            {info.fileName ? (
              <FileSummary fileName={info.fileName} size={info.size} />
            ) : null}

            {info.highlights?.summary ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {info.highlights.summary}
              </p>
            ) : null}

            {info.highlights?.latestRole ? (
              <HighlightRow
                icon={Briefcase}
                label="Latest role"
                value={info.highlights.latestRole}
              />
            ) : null}

            {info.highlights?.education ? (
              <HighlightRow
                icon={GraduationCap}
                label="Education"
                value={info.highlights.education}
              />
            ) : null}

            {info.highlights && info.highlights.topSkills.length > 0 ? (
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Sparkles aria-hidden="true" className="h-3 w-3 text-accent" />
                  Top skills
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {info.highlights.topSkills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full border border-border bg-surface-strong px-2 py-0.5 text-[11px] text-foreground"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-auto flex items-center justify-end">
              <Button variant="secondary" size="sm" onClick={openPicker} disabled={isBusy}>
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Replace
              </Button>
            </div>
          </>
        ) : null}

        {status === "failed" && hasResume ? (
          <>
            {info.fileName ? (
              <FileSummary fileName={info.fileName} size={info.size} />
            ) : null}

            {error ? <ErrorNote message={error} /> : null}

            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void retry()} disabled={isBusy}>
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Retry
              </Button>
              <Button variant="secondary" size="sm" onClick={openPicker} disabled={isBusy}>
                Replace
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
