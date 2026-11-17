import { Interview, type InterviewStatus } from "@/models/Interview";
import type { InterviewTurn } from "@/models/InterviewTurn";
import type { IInterviewRepository } from "@/repositories/InterviewRepository";
import type { IInterviewTurnRepository } from "@/repositories/InterviewTurnRepository";

export interface InterviewHistoryItem {
  readonly id: string;
  readonly role: string;
  readonly status: InterviewStatus;
  readonly score: number | null;
  readonly createdAt: string;
}

export interface InterviewReportData {
  readonly interview: Interview;
  readonly turns: readonly InterviewTurn[];
}

/** Provides owner-scoped interview history and stored report data. */
export class InterviewHistoryService {
  private readonly interviews: IInterviewRepository;
  private readonly turns: IInterviewTurnRepository;

  constructor(
    interviews: IInterviewRepository,
    turns: IInterviewTurnRepository,
  ) {
    this.interviews = interviews;
    this.turns = turns;
  }

  async getAllForUser(userId: string): Promise<InterviewHistoryItem[]> {
    const interviews = await this.interviews.getAllByUser(userId);
    return interviews.map((interview) => ({
      id: interview.id,
      role: interview.role,
      status: interview.status,
      score: interview.overallScore,
      createdAt: interview.createdAt,
    }));
  }

  async getReportForUser(
    userId: string,
    interviewId: string,
  ): Promise<InterviewReportData | null> {
    const interview = await this.interviews.findByIdForUser(userId, interviewId);
    if (!interview) return null;

    const turns = await this.turns.listByInterview(userId, interview.id);
    return { interview, turns };
  }
}
