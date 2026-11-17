import type { Step } from "@/models/Step";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface HowItWorksProps {
  steps: readonly Step[];
}

/** Four-step flow from resume to report. */
export function HowItWorks({ steps }: HowItWorksProps) {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-24 md:py-32">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From resume to report in four steps"
          description="Set up in under a minute. Your first realistic mock interview is free."
        />

        <ol className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
          />
          {steps.map((step, index) => (
            <li key={step.index} className="relative">
              <Reveal delay={index * 0.1} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-accent/40">
                  <div className="flex items-center justify-between">
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_12px_28px_-14px_var(--glow)]"
                    >
                      <Icon name={step.icon} className="h-5 w-5" />
                    </span>
                    <span className="font-display text-sm font-semibold text-muted-foreground/70">
                      0{step.index}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
