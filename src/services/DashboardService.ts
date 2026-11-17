import { Interview, type InterviewStatus } from "@/models/Interview";
import type { Profile } from "@/models/Profile";
import type { ResumeInfo, ResumeStatus } from "@/models/ResumeInfo";
import { User } from "@/models/User";
import type { IInterviewRepository, InterviewStats } from "@/repositories/InterviewRepository";
import type { IProfileRepository } from "@/repositories/ProfileRepository";
import type { IResumeRepository } from "@/repositories/ResumeRepository";
import { buildResumeInfo } from "@/lib/resume/presentation";

export type { ResumeInfo, ResumeStatus };

/** One row of the user's interview list. */
export interface InterviewSummary {
  readonly id: string;
  readonly role: string;
  readonly status: InterviewStatus;
  readonly score: number | null;
  readonly createdAt: string;
}

/** Profile and resume shown before slower dashboard sections stream in. */
export interface DashboardOverviewData {
  readonly user: User;
  readonly profile: Profile;
  readonly resume: ResumeInfo;
}

/** Everything the dashboard page needs when all sections are resolved. */
export interface DashboardData extends DashboardOverviewData {
  readonly recentInterviews: readonly InterviewSummary[];
  readonly stats: InterviewStats;
}

/** How many interviews the "Recent Interviews" list shows. */
const RECENT_LIMIT = 5;

/**
 * Composes the profile, resume, and interview repositories into the single
 * typed payload the dashboard renders. Repositories arrive via constructor
 * injection so this class never touches Supabase directly.
 */
export class DashboardService {
  private readonly profiles: IProfileRepository;
  private readonly interviews: IInterviewRepository;
  private readonly resumes: IResumeRepository;

  constructor(
    profiles: IProfileRepository,
    interviews: IInterviewRepository,
    resumes: IResumeRepository,
  ) {
    this.profiles = profiles;
    this.interviews = interviews;
    this.resumes = resumes;
  }

  async getDashboardData(user: User): Promise<DashboardData> {
    const [overview, recentInterviews, stats] = await Promise.all([
      this.getDashboardOverviewData(user),
      this.getRecentInterviews(user.id),
      this.getStats(user.id),
    ]);

    return { ...overview, recentInterviews, stats };
  }

  async getDashboardOverviewData(user: User): Promise<DashboardOverviewData> {
    const [profile, resume] = await Promise.all([
      this.profiles.getByUserId(user.id),
      this.resumes.findLatestByUserId(user.id),
    ]);

    const resumeProfile = resume
      ? await this.resumes.findProfileByResumeId(user.id, resume.id)
      : null;

    return {
      user,
      profile,
      resume: buildResumeInfo(resume, resumeProfile),
    };
  }

  async getRecentInterviews(userId: string): Promise<InterviewSummary[]> {
    const recent = await this.interviews.getRecentByUser(userId, RECENT_LIMIT);
    return recent.map((item) => this.toSummary(item));
  }

  getStats(userId: string): Promise<InterviewStats> {
    return this.interviews.getStats(userId);
  }

  private toSummary(interview: Interview): InterviewSummary {
    return {
      id: interview.id,
      role: interview.role,
      status: interview.status,
      score: interview.overallScore,
      createdAt: interview.createdAt,
    };
  }
}
