"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { validateResumeFile } from "@/lib/resume/constants";
import type { ResumeInfo } from "@/models/ResumeInfo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ResumeApiClient, ResumeClientError } from "@/services/resume/ResumeApiClient";
import { ResumeClientService } from "@/services/resume/ResumeClientService";
import { ResumeStorageService } from "@/services/resume/ResumeStorageService";

const POLL_INTERVAL_MS = 2500;

export type ResumeCardStatus = "uploading" | ResumeInfo["status"];

export interface ResumeDragHandlers {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

export interface ResumeCardController {
  readonly info: ResumeInfo;
  readonly status: ResumeCardStatus;
  readonly progress: number;
  readonly activeFileName: string | null;
  readonly error: string | null;
  readonly isDragging: boolean;
  readonly isBusy: boolean;
  readonly uploadFile: (file: File) => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly dragHandlers: ResumeDragHandlers;
}

/**
 * Owns the card's state machine. All network work is delegated to
 * ResumeClientService; this hook only sequences UI states and polling.
 */
export function useResumeCard(initial: ResumeInfo): ResumeCardController {
  const router = useRouter();
  const serviceRef = useRef<ResumeClientService | null>(null);

  const [info, setInfo] = useState<ResumeInfo>(initial);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initial.errorMessage);
  const [isDragging, setIsDragging] = useState(false);

  // Created on first interaction so no browser client is constructed during SSR.
  const getService = useCallback((): ResumeClientService => {
    if (!serviceRef.current) {
      serviceRef.current = new ResumeClientService(
        new ResumeStorageService(createSupabaseBrowserClient()),
        new ResumeApiClient(),
      );
    }
    return serviceRef.current;
  }, []);

  const runParse = useCallback(
    async (resumeId: string): Promise<void> => {
      setParsing(true);
      try {
        const final = await getService().parse(resumeId);
        setInfo(final);
        setError(final.errorMessage);

        if (final.status === "ready") {
          toast.success("Resume ready — your interview questions can use it.");
        } else if (final.status === "failed") {
          toast.error(final.errorMessage ?? "We couldn't parse that resume.");
        }

        router.refresh();
      } catch (caught) {
        const message =
          caught instanceof ResumeClientError
            ? caught.message
            : "We couldn't parse that resume. Please try again.";
        setError(message);
        setInfo((current) => ({
          ...current,
          status: "failed",
          errorMessage: message,
        }));
        toast.error(message);
      } finally {
        setParsing(false);
      }
    },
    [getService, router],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      const validation = validateResumeFile(file);
      if (validation) {
        setError(validation.message);
        toast.error(validation.message);
        return;
      }

      setError(null);
      setProgress(0);
      setActiveFileName(file.name);
      setUploading(true);

      let registered: ResumeInfo | null = null;

      try {
        registered = await getService().upload(file, setProgress);
        setInfo(registered);
        setUploading(false);
        toast.success("Resume uploaded. Analysing your experience…");

        if (!registered.resumeId) {
          throw new ResumeClientError("We couldn't save that resume. Please try again.");
        }

        await runParse(registered.resumeId);
      } catch (caught) {
        const message =
          caught instanceof ResumeClientError
            ? caught.message
            : "We couldn't upload that resume. Please try again.";
        setError(message);
        setInfo((current) => ({
          ...current,
          status: current.resumeId ? "failed" : "not_uploaded",
          errorMessage: message,
        }));
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [getService, runParse],
  );

  const retry = useCallback(async (): Promise<void> => {
    if (!info.resumeId) return;
    setError(null);
    await runParse(info.resumeId);
  }, [info.resumeId, runParse]);

  // Poll while work is in flight so the card reflects server-side progress
  // even if the parse request is slow or briefly disconnects.
  useEffect(() => {
    if (!parsing && info.status !== "pending" && info.status !== "processing") {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(() => {
      void getService()
        .getStatus()
        .then((latest) => {
          if (cancelled) return;
          setInfo(latest);
          if (latest.status === "failed") setError(latest.errorMessage);
        })
        .catch(() => {
          // Polling is best-effort; the parse request stays authoritative.
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [getService, info.status, parsing]);

  const status: ResumeCardStatus = uploading
    ? "uploading"
    : parsing
      ? "processing"
      : info.status;

  const dragHandlers: ResumeDragHandlers = {
    onDragEnter: (event) => {
      event.preventDefault();
      if (!uploading && !parsing) setIsDragging(true);
    },
    onDragOver: (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event) => {
      event.preventDefault();
      setIsDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setIsDragging(false);
      if (uploading || parsing) return;
      const file = event.dataTransfer.files.item(0);
      if (file) void uploadFile(file);
    },
  };

  return {
    info,
    status,
    progress,
    activeFileName,
    error,
    isDragging,
    isBusy: uploading || parsing || status === "pending" || status === "processing",
    uploadFile,
    retry,
    dragHandlers,
  };
}
