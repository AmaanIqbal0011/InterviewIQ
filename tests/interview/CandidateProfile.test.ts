import { describe, expect, it } from "vitest";
import { CandidateProfile } from "@/services/interview/CandidateProfile";
import { candidateContextSchema } from "@/lib/validation/candidateContextSchemas";

function parseContext(overrides: Record<string, unknown>) {
  return candidateContextSchema.parse({
    candidate: { full_name: "Grace Hopper", country: null, city: null, current_status: "Engineer" },
    goals: {
      target_role: "Backend Engineer",
      target_industry: null,
      experience_level: "mid",
      target_companies: [],
      interview_type: "technical",
      difficulty: "medium",
      interview_language: "english",
      practice_goals: [],
      additional_notes: null,
    },
    onboarding: {
      education: [
        {
          level: "Bachelor",
          field_of_study: "CS",
          institution: "MIT",
          start_year: 2015,
          end_year: 2019,
          is_current: false,
          grade: null,
        },
      ],
      work_experience: [],
      skills: [{ name: "Leadership", category: "soft", level: "advanced" }],
      languages: [{ language: "English", proficiency: "native", is_interview_language: true }],
    },
    resume: null,
    has_completed_resume: false,
    ...overrides,
  });
}

const resume = {
  full_name: "Ada Lovelace",
  summary: "Mathematician interested in engines.",
  skills: { technical: ["Pascal", "Analysis"], soft: ["Rigour"] },
  experience: [
    {
      title: "Analyst",
      company: "Babbage & Co",
      start_date: "1840",
      end_date: "1843",
      is_current: false,
      highlights: ["Documented the Analytical Engine"],
    },
  ],
  projects: [{ name: "Bernoulli Numbers", tech_stack: ["Math"], description: "First algorithm." }],
  education: [
    {
      degree: "BSc",
      field_of_study: "Mathematics",
      institution: "London",
      start_date: null,
      end_date: null,
      grade: null,
    },
  ],
  certifications: [],
  languages: [],
};

describe("CandidateProfile.fromContext", () => {
  it("prefers the CV name over the onboarding name", () => {
    const profile = CandidateProfile.fromContext(parseContext({ resume, has_completed_resume: true }));

    expect(profile.fullName).toBe("Ada Lovelace");
    expect(profile.firstName).toBe("Ada");
    expect(profile.source).toBe("cv");
    expect(profile.hasName).toBe(true);
  });

  it("falls back to the onboarding name when there is no CV", () => {
    const profile = CandidateProfile.fromContext(parseContext({}));

    expect(profile.fullName).toBe("Grace Hopper");
    expect(profile.firstName).toBe("Grace");
    expect(profile.source).toBe("onboarding");
  });

  it("reports unknown when neither side carries a usable name", () => {
    const profile = CandidateProfile.fromContext(
      parseContext({ candidate: { full_name: "  ", country: null, city: null, current_status: null } }),
    );

    expect(profile.fullName).toBeNull();
    expect(profile.firstName).toBeNull();
    expect(profile.hasName).toBe(false);
    expect(profile.source).toBe("unknown");
  });

  it("merges CV and onboarding skills without duplicates", () => {
    const profile = CandidateProfile.fromContext(parseContext({ resume, has_completed_resume: true }));

    expect(profile.skills).toContain("Pascal");
    expect(profile.skills).toContain("Leadership");
    expect(new Set(profile.skills).size).toBe(profile.skills.length);
  });

  it("turns CV projects into named hooks with their tech stack", () => {
    const profile = CandidateProfile.fromContext(parseContext({ resume, has_completed_resume: true }));
    const hooks = profile.hooks();

    expect(profile.projects[0].name).toBe("Bernoulli Numbers");
    expect(hooks.some((hook) => hook.includes("Bernoulli Numbers"))).toBe(true);
  });

  it("describes experience from both sources", () => {
    const profile = CandidateProfile.fromContext(parseContext({ resume, has_completed_resume: true }));

    expect(profile.experience.join(" ")).toContain("Analyst at Babbage & Co");
    expect(profile.describe()).toContain("Candidate name: Ada Lovelace.");
    expect(profile.describe()).toContain("Source: their uploaded CV.");
  });

  it("derives the education level from the CV first", () => {
    const profile = CandidateProfile.fromContext(parseContext({ resume, has_completed_resume: true }));
    expect(profile.educationLevel).toBe("BSc");
  });

  it("falls back to onboarding education when there is no CV", () => {
    const profile = CandidateProfile.fromContext(parseContext({}));
    expect(profile.educationLevel).toBe("Bachelor");
  });

  it("says so plainly when there is nothing beyond a name", () => {
    const profile = CandidateProfile.fromContext(
      parseContext({
        candidate: { full_name: "Sam", country: null, city: null, current_status: null },
        onboarding: {
          education: [],
          work_experience: [],
          skills: [],
          languages: [],
        },
      }),
    );

    expect(profile.describe()).toContain("No profile details are available beyond the name.");
  });
});
