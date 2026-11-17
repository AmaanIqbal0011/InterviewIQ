import type { Stat } from "@/models/Stat";
import { Container } from "@/components/ui/Container";

interface SocialProofProps {
  stats: readonly Stat[];
}

/** Thin trust strip with placeholder platform statistics. */
export function SocialProof({ stats }: SocialProofProps) {
  return (
    <section aria-label="Platform results" className="border-y border-border bg-surface/40 backdrop-blur-xl">
      <Container>
        <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="px-6 py-8 text-center sm:py-10">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="gradient-text">{stat.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
