import type { Metadata } from "next";
import NewInterviewForm from "./NewInterviewForm";

export const metadata: Metadata = {
  title: "New Interview",
  robots: { index: false, follow: false },
};

export default function NewInterviewPage() {
  return <NewInterviewForm />;
}
