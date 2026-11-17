import type { ReportContent } from "@/models/ReportContent";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { ScoreRing } from "@/components/landing/ScoreRing";
import { SkillBars } from "@/components/landing/SkillBars";

interface ReportPreviewProps {
  report: ReportContent;
}

/** Mock performance report with score ring, skill bars and feedback lists. */
export function ReportPreview({ report }: ReportPreviewProps) {
  return (
    <section
      id="report"
      className="scroll-mt-24 border-y border-border bg-surface/30 py-24 md:py-32"
    >
      <Container>
        <SectionHeading
          eyebrow={report.eyebrow}
          title={report.title}
          description={report.description}
        />

        <Reveal className="mt-14">
          <div className="rounded-3xl border border-border bg-surface/80 p-5 shadow-[0_40px_90px_-50px_var(--glow)] backdrop-blur-2xl sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge variant="accent">{report.eyebrow}</Badge>
                <h3 className="mt-3 text-base font-semibold text-foreground sm:text-lg">
                  {report.roleLabel}
                </h3>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  {report.dateLabel}
                </p>
              </div>
              <div className="flex items-center justify-end">
                <ScoreRing score={report.overallScore} label={report.overallLabel} />
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="rounded-2xl border border-border bg-background/50 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon name="gauge" className="h-4 w-4 text-accent" />
                  {report.skillsLabel}
                </h4>
                <div className="mt-5">
                  <SkillBars
                    skills={report.skills.map((skill) => ({
                      label: skill.label,
                      value: skill.value,
                    }))}
                  />
                </div>
              </div>

              <div className="grid gap-6">
                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon name="check" className="h-4 w-4 text-success" />
                    {report.strengthsLabel}
                  </h4>
                  <ul className="mt-3 space-y-2.5">
                    {report.strengths.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Icon
                          name="check"
                          className="mt-0.5 h-4 w-4 shrink-0 text-success"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-5">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon name="target" className="h-4 w-4 text-warning" />
                    {report.improvementsLabel}
                  </h4>
                  <ul className="mt-3 space-y-2.5">
                    {report.improvements.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Icon
                          name="target"
                          className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{report.overallLabel}: </span>
                {report.summary}
              </p>
              <Button href={report.cta.href} className="shrink-0">
                {report.cta.label}
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
