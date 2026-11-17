import type { ShowcaseContent } from "@/models/ShowcaseContent";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { Conversation } from "@/components/landing/Conversation";

interface AvatarShowcaseProps {
  showcase: ShowcaseContent;
}

/** Larger section walking through the live interview experience. */
export function AvatarShowcase({ showcase }: AvatarShowcaseProps) {
  return (
    <section id="avatar" className="relative scroll-mt-24 overflow-hidden py-24 md:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[-15%] top-1/4 h-[420px] w-[560px] rounded-full bg-gradient-to-br from-accent/20 via-accent-2/15 to-accent-3/20 blur-[110px]" />
      </div>

      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            align="left"
            eyebrow={showcase.eyebrow}
            title={showcase.title}
            description={showcase.description}
          />

          <ul className="mt-8 space-y-4">
            {showcase.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                >
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{bullet}</span>
              </li>
            ))}
          </ul>

          <Reveal delay={0.1}>
            <div className="mt-9">
              <Button href={showcase.cta.href} size="lg">
                {showcase.cta.label}
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} y={32}>
          <Conversation
            title={showcase.panelTitle}
            subtitle={showcase.panelSubtitle}
            liveLabel={showcase.liveLabel}
            turns={showcase.messages.map((message) => ({
              role: message.role,
              text: message.text,
            }))}
            footerNote={showcase.footerNote}
          />
        </Reveal>
      </Container>
    </section>
  );
}
