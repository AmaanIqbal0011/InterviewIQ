import { z } from "zod";

export type QuestionType = "main" | "followup";

const interviewEvaluationSchema = z.object({
  score: z.number().min(0).max(10).optional(),
  relevance: z.number().min(0).max(10).optional(),
  depth: z.number().min(0).max(10).optional(),
  clarity: z.number().min(0).max(10).optional(),
  strengths: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  feedback: z.union([z.string(), z.array(z.string())]).optional(),
  improvements: z.union([z.string(), z.array(z.string())]).optional(),
  suggestedFollowUp: z.string().nullable().optional(),
  fallback: z.boolean().optional(),
});

export type InterviewEvaluation = z.infer<typeof interviewEvaluationSchema>;

export interface InterviewTurnProps {
  readonly id: string;
  readonly interviewId: string;
  readonly turnIndex: number;
  readonly questionType: string;
  readonly questionText: string;
  readonly topic: string | null;
  readonly answerText: string | null;
  readonly evaluation: unknown;
  readonly createdAt: string;
}

export class InterviewTurn {
  readonly id: string;
  readonly interviewId: string;
  readonly turnIndex: number;
  readonly questionType: string;
  readonly questionText: string;
  readonly topic: string | null;
  readonly answerText: string | null;
  readonly evaluation: InterviewEvaluation | null;
  readonly createdAt: string;

  constructor(props: InterviewTurnProps) {
    this.id = props.id;
    this.interviewId = props.interviewId;
    this.turnIndex = props.turnIndex;
    this.questionType = props.questionType;
    this.questionText = props.questionText;
    this.topic = props.topic;
    this.answerText = props.answerText;
    const evaluation = interviewEvaluationSchema.safeParse(props.evaluation);
    this.evaluation = evaluation.success ? evaluation.data : null;
    this.createdAt = props.createdAt;
  }
}