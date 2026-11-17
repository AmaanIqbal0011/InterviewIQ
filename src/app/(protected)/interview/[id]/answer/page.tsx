import type { Metadata } from "next";
import AnswerClient from "./client";

export const metadata: Metadata = {
  title: "Interview Answer",
  robots: { index: false, follow: false },
};

export default function AnswerPage() {
  return <AnswerClient />;
}
