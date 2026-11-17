import type { Feature } from "@/models/Feature";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface FeaturesProps {
  features: readonly Feature[];
}

/** Six-card product feature grid. */
export function Features({ features }: FeaturesProps) {
  return (
    <section id="features" className="scroll-mt-24 py-24 md:py-32">
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to walk in prepared"
          description="A full mock interview loop — realistic voice, tailored questions and feedback you can act on."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 3) * 0.08} className="h-full">
              <Card className="group relative h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="flex items-start justify-between gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_12px_28px_-14px_var(--glow)]"
                  >
                    <Icon name={feature.icon} className="h-5 w-5" />
                  </span>
                  {feature.badge ? <Badge variant="accent">{feature.badge}</Badge> : null}
                </div>
                <h3 className="mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
