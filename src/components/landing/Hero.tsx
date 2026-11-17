import type { HeroContent } from "@/models/HeroContent";
import { splitHighlight } from "@/lib/splitHighlight";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/motion/Reveal";
import { InterviewMockup } from "@/components/landing/InterviewMockup";

interface HeroProps {
  hero: HeroContent;
}

/** Above-the-fold hero with the live interview mockup. */
export function Hero({ hero }: HeroProps) {
  const { lead, highlight, tail } = splitHighlight(hero.headline, hero.headlineHighlight);

  return (
    <section id="top" className="relative scroll-mt-24 overflow-hidden pb-20 pt-14 md:pb-28 md:pt-20 lg:pb-32 lg:pt-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[460px] w-[860px] -translate-x-1/2 rounded-full bg-gradient-to-br from-accent/30 via-accent-2/20 to-accent-3/25 blur-[110px]" />
        <div className="grid-backdrop absolute inset-0" />
      </div>

      <Container className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="max-w-xl">
          <Reveal>
            <Badge variant="accent">
              <Icon name="sparkles" className="h-3 w-3" />
              {hero.badge}
            </Badge>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              {lead}
              {highlight ? <span className="gradient-text">{highlight}</span> : null}
              {tail}
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {hero.subheadline}
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href={hero.primaryAction.href} size="lg">
                {hero.primaryAction.label}
              </Button>
              <Button href={hero.secondaryAction.href} variant="secondary" size="lg">
                {hero.secondaryAction.label}
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="shield" className="h-3.5 w-3.5 text-success" />
              {hero.trustNote}
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.3} y={32} className="lg:justify-self-end">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <InterviewMockup {...hero.mockup} />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
