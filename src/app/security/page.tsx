import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Security",
};

export default function SecurityPage() {
  return <LegalPage kind="security" />;
}
