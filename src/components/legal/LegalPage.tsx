import { Container } from "@/components/ui/Container";
import { legalContentService, type LegalDocumentKey } from "@/services/LegalContentService";

interface LegalPageProps {
  kind: LegalDocumentKey;
}

export function LegalPage({ kind }: LegalPageProps) {
  const title = legalContentService.getTitle(kind);
  const paragraphs = legalContentService.getDocument(kind).split("\n\n");

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Legal
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground sm:text-base">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
