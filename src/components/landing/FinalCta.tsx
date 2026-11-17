import type { CtaContent } from "@/models/CtaContent";
import { splitHighlight } from "@/lib/splitHighlight";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";

interface FinalCtaProps {
  cta: CtaContent;
}

/** Closing call-to-action banner. */
export function FinalCta({ cta }: FinalCtaProps) {
  const { lead, highlight, tail } = splitHighlight(cta.title, cta.titleHighlight);

  return (
    <section id="get-started" className="scroll-mt-24 pb-24 pt-4 md:pb-32">
      <Container>
        <div className="rounded-[calc(1.5rem+1.5px)] bg-gradient-to-br from-accent/70 via-accent-2/50 to-accent-3/60 p-[1.5px] shadow-[0_40px_90px_-45px_var(--glow)]">
          <div className="relative overflow-hidden rounded-3xl bg-background px-6 py-14 text-center sm:px-12 md:py-18">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-r from-accent/30 via-accent-2/25 to-accent-3/30 blur-[80px]" />
            </div>

            <div className="relative">
              <Badge variant="accent" className="mx-auto">
                <Icon name="sparkles" className="h-3 w-3" />
                {cta.eyebrow}
              </Badge>

              <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl lg:leading-[1.1]">
                {lead}
                {highlight ? <span className="gradient-text">{highlight}</span> : null}
                {tail}
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                {cta.description}
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button href={cta.primaryAction.href} size="lg">
                  {cta.primaryAction.label}
                </Button>
                <Button href={cta.secondaryAction.href} variant="secondary" size="lg">
                  {cta.secondaryAction.label}
                </Button>
              </div>

              <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="shield" className="h-3.5 w-3.5 text-success" />
                {cta.note}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
