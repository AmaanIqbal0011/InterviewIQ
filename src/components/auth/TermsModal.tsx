"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { legalContentService, type LegalDocumentKey } from "@/services/LegalContentService";
import { EASE_OUT } from "@/lib/motion";

interface TermsModalProps {
  open: boolean;
  kind: LegalDocumentKey;
  onClose: () => void;
  /** When provided, renders an "I Agree" button that closes and consents. */
  onAgree?: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/**
 * Scrollable legal modal. Keeps focus trapped while open, restores it to the
 * trigger on close, and never navigates — so the form behind it keeps every
 * value the user already typed.
 */
export function TermsModal({ open, kind, onClose, onAgree }: TermsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Callbacks are read through a ref so the effect only re-runs on open/close.
  const handlersRef = useRef({ onClose, onAgree });
  useEffect(() => {
    handlersRef.current = { onClose, onAgree };
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    restoreFocusTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        handlersRef.current.onClose();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const items = focusableWithin(dialogRef.current);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (active instanceof Node && !dialogRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus();
    };
  }, [open]);

  const title = legalContentService.getTitle(kind);
  const content = legalContentService.getDocument(kind);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            aria-hidden="true"
            onClick={onClose}
            className="absolute inset-0 bg-background/75 backdrop-blur-sm"
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-[0_40px_100px_-40px_var(--glow)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Legal
                </p>
                <h2
                  id={titleId}
                  className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground"
                >
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {content}
              </div>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              {onAgree ? <Button onClick={onAgree}>I Agree</Button> : null}
            </footer>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
