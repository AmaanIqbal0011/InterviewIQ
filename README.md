# InterviewIQ

InterviewIQ is an AI interview coach built with Next.js App Router, TypeScript,
Tailwind CSS, Supabase, Zod, React Hook Form, and Framer Motion.

## Getting Started

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your Supabase project.
2. In the Supabase Dashboard SQL Editor, run the schema files in order:
   `002_onboarding.sql` (profiles, ownership policies, triggers) before signing up
   a user, then `003_interviews.sql` (interview history), then `004_resumes.sql`
   (private `resumes` storage bucket plus the `resumes` and `resume_profiles`
   tables). Every file is idempotent, so re-running them is safe.
3. Set `GEMINI_API_KEY` in `.env.local` to enable resume parsing. Without it the
   dashboard still loads, and uploading a resume reports a configuration error.
4. Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app. A signed-in
user completes the onboarding wizard before reaching the profile summary
dashboard.

Run `npm run lint` and `npm run build` to validate the application.
