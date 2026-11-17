import { landingContentService } from "@/services/LandingContentService";
import { Hero } from "@/components/landing/Hero";
import { SocialProof } from "@/components/landing/SocialProof";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { AvatarShowcase } from "@/components/landing/AvatarShowcase";
import { ReportPreview } from "@/components/landing/ReportPreview";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

export default function Home() {
  const content = landingContentService;

  return (
    <>
      <Hero hero={content.getHero()} />
      <SocialProof stats={content.getStats()} />
      <HowItWorks steps={content.getSteps()} />
      <Features features={content.getFeatures()} />
      <AvatarShowcase showcase={content.getShowcase()} />
      <ReportPreview report={content.getReport()} />
      <Faq faqs={content.getFaqs()} />
      <FinalCta cta={content.getCta()} />
    </>
  );
}
