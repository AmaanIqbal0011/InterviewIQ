import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ProfileRepository } from "@/repositories/ProfileRepository";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const userId = "user-1";

function makeProfileRow(id: string, fullName: string): ProfileRow {
  return {
    id,
    full_name: fullName,
    country: null,
    city: null,
    current_status: null,
    onboarding_completed: false,
    onboarding_step: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function createSupabaseMock(options: {
  profile?: ProfileRow | null;
  insertError?: { code: string; message: string };
  insertConflict?: boolean;
  metadataFullName?: string;
} = {}) {
  let profile = options.profile ?? null;
  const insert = vi.fn(async ({ id, full_name }: { id: string; full_name: string }) => {
    if (options.insertError) return { data: null, error: options.insertError };
    if (options.insertConflict) {
      profile = makeProfileRow(id, full_name);
      return { data: null, error: { code: "23505", message: "duplicate key" } };
    }

    profile = makeProfileRow(id, full_name);
    return { data: null, error: null };
  });
  const update = vi.fn<(values: Partial<ProfileRow>) => unknown>();

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: userId,
            email: "member@example.test",
            user_metadata: options.metadataFullName
              ? { full_name: options.metadataFullName }
              : {},
          },
        },
        error: null,
      })),
    },
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: profile, error: null })),
        single: vi.fn(async () => ({ data: profile, error: null })),
        insert,
        update,
      };
      update.mockImplementation((values) => {
        if (profile) profile = { ...profile, ...values };
        return query;
      });
      return query;
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    insert,
    update,
  };
}

describe("ProfileRepository.getByUserId", () => {
  it("creates and reloads a missing profile for the authenticated user", async () => {
    const { client, insert } = createSupabaseMock();
    const repository = new ProfileRepository(client);

    const profile = await repository.getByUserId(userId);

    expect(insert).toHaveBeenCalledWith({ id: userId, full_name: "member" });
    expect(profile.id).toBe(userId);
    expect(profile.fullName).toBe("member");
    expect(profile.onboardingStep).toBe(1);
  });

  it("re-reads after a concurrent insert wins the unique-key race", async () => {
    const { client, insert } = createSupabaseMock({ insertConflict: true });
    const repository = new ProfileRepository(client);

    const profile = await repository.getByUserId(userId);

    expect(insert).toHaveBeenCalledWith({ id: userId, full_name: "member" });
    expect(profile.id).toBe(userId);
  });

  it("keeps a metadata name within the database column limit", async () => {
    const metadataFullName = "a".repeat(90);
    const { client, insert } = createSupabaseMock({ metadataFullName });
    const repository = new ProfileRepository(client);

    await repository.getByUserId(userId);

    expect(insert).toHaveBeenCalledWith({
      id: userId,
      full_name: metadataFullName.slice(0, 80),
    });
  });

  it("surfaces non-conflict insert errors", async () => {
    const { client } = createSupabaseMock({
      insertError: { code: "42501", message: "permission denied" },
    });
    const repository = new ProfileRepository(client);
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(repository.getByUserId(userId)).rejects.toMatchObject({ code: "database" });

    expect(logError).toHaveBeenCalledWith("Database operation failed", {
      code: "42501",
      message: "permission denied",
      details: "not provided",
      hint: "not provided",
    });
  });

  it("completes onboarding without advancing beyond the four-step constraint", async () => {
    const { client, update } = createSupabaseMock({
      profile: { ...makeProfileRow(userId, "Member"), onboarding_step: 4 },
    });
    const repository = new ProfileRepository(client);

    const profile = await repository.complete(userId);

    expect(update).toHaveBeenCalledWith({
      onboarding_completed: true,
      onboarding_step: 4,
    });
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.onboardingStep).toBe(4);
  });
});
