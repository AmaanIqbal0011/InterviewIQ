import type { Faq as FaqModel } from "@/models/Faq";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Accordion } from "@/components/ui/Accordion";

interface FaqProps {
  faqs: readonly FaqModel[];
}

/** FAQ section built on the shared accessible accordion. */
export function Faq({ faqs }: FaqProps) {
  const items = faqs.map((faq, index) => ({
    id: `faq-${index + 1}`,
    question: faq.question,
    answer: faq.answer,
  }));

  return (
    <section id="faq" className="scroll-mt-24 py-24 md:py-32">
      <Container>
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Everything you need to know before your first session."
        />
        <Accordion
          className="mx-auto mt-12 max-w-3xl"
          items={items}
          defaultOpenId="faq-1"
          headingLevel={3}
        />
      </Container>
    </section>
  );
}
