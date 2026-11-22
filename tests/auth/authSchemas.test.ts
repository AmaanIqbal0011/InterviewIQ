import { describe, expect, it } from "vitest";
import { signupSchema } from "@/lib/validation/authSchemas";

const signupValues = {
  fullName: "Member Name",
  email: "member@example.test",
  password: "Password123",
  acceptedTerms: true,
};

describe("signupSchema", () => {
  it("rejects a confirmation value that does not match the password", () => {
    const result = signupSchema.safeParse({
      ...signupValues,
      confirmPassword: signupValues.email,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["confirmPassword"] }),
      );
    }
  });

  it("accepts matching password and confirmation values", () => {
    const result = signupSchema.safeParse({
      ...signupValues,
      confirmPassword: signupValues.password,
    });

    expect(result.success).toBe(true);
  });
});
