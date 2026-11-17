import { describe, expect, it, vi } from "vitest";
import { Interview } from "@/models/Interview";
import { InterviewTurn } from "@/models/InterviewTurn";
import type { IInterviewRepository } from "@/repositories/InterviewRepository";
import type { IInterviewTurnRepository } from "@/repositories/InterviewTurnRepository";
import { InterviewHistoryService } from "@/services/InterviewHistoryService";

function createRepositories() {
  const interviews: IInterviewRepository = {
    getRecentByUser: vi.fn<IInterviewRepository["getRecentByUser"]>(),
    getAllByUser: vi.fn<IInterviewRepository["getAllByUser"]>(),
    getStats: vi.fn<IInterviewRepository["getStats"]>(),
    findByIdForUser: vi.fn<IInterviewRepository["findByIdForUser"]>(),
    create: vi.fn<IInterviewRepository["create"]>(),
    markInProgress: vi.fn<IInterviewRepository["markInProgress"]>(),
    markCompleted: vi.fn<IInterviewRepository["markCompleted"]>(),
    setReportStatus: vi.fn<IInterviewRepository["setReportStatus"]>(),
  };
  const turns: IInterviewTurnRepository = {
    listByInterview: vi.fn<IInterviewTurnRepository["listByInterview"]>(),
    listRecent: vi.fn<IInterviewTurnRepository["listRecent"]>(),
    insertTurn: vi.fn<IInterviewTurnRepository["insertTurn"]>(),
    getTurn: vi.fn<IInterviewTurnRepository["getTurn"]>(),
    updateEvaluation: vi.fn<IInterviewTurnRepository["updateEvaluation"]>(),
  };

  return { interviews, turns, service: new InterviewHistoryService(interviews, turns) };
}

function makeInterview(): Interview {
  return new Interview({
    id: "interview-1",
    user_id: "user-1",
    role: "Software Engineer",
    status: "completed",
    config: null,
    context_snapshot: null,
    started_at: null,
    completed_at: null,
    overall_score: 80,
    report_status: "pending",
    created_at: "2026-01-01T00:00:00.000Z",
  });
}

describe("InterviewHistoryService", () => {
  it("maps all owner interviews into history items", async () => {
    const { interviews, service } = createRepositories();
    vi.mocked(interviews.getAllByUser).mockResolvedValue([makeInterview()]);

    await expect(service.getAllForUser("user-1")).resolves.toEqual([
      {
        id: "interview-1",
        role: "Software Engineer",
        status: "completed",
        score: 80,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(interviews.getAllByUser).toHaveBeenCalledWith("user-1");
  });

  it("loads stored turns only after finding an interview owned by the user", async () => {
    const { interviews, turns, service } = createRepositories();
    vi.mocked(interviews.findByIdForUser).mockResolvedValue(null);

    await expect(service.getReportForUser("user-1", "other-interview")).resolves.toBeNull();
    expect(turns.listByInterview).not.toHaveBeenCalled();

    const interview = makeInterview();
    const turn = new InterviewTurn({
      id: "turn-1",
      interviewId: interview.id,
      turnIndex: 0,
      questionType: "main",
      questionText: "Tell me about your experience.",
      topic: "experience",
      answerText: "I led a team.",
      evaluation: { score: 8, strengths: ["Leadership"] },
      createdAt: "2026-01-01T00:01:00.000Z",
    });
    vi.mocked(interviews.findByIdForUser).mockResolvedValue(interview);
    vi.mocked(turns.listByInterview).mockResolvedValue([turn]);

    await expect(service.getReportForUser("user-1", interview.id)).resolves.toEqual({
      interview,
      turns: [turn],
    });
    expect(turns.listByInterview).toHaveBeenCalledWith("user-1", interview.id);
  });
});
