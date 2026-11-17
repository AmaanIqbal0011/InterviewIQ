# Progress Log

## Phase B Status: COMPLETE ✅

### Completed (Phase C)
- Task 1: Removed mock LLM from production code - replaced with real `createLLMClientFromEnv()` factory in `src/app/(protected)/interview/actions.ts` (lines 10, 57). If env vars missing, throws typed error with friendly message "Interview service is not configured. Please contact the administrator."
- Task 2: Fixed interview status - interview now marked `in_progress` once first question saved (actions.ts lines 114-118). If first question fails, interview is rolled back/deleted (actions.ts lines 122-128).
- Task 3: Restored test suite with follow-up logic - 60/60 tests passing across 7 test files (>= 46 requirement met). typecheck: 0 errors. lint: 0 errors, 7 warnings (all pre-existing).
- Task 4: Verification output complete.

### Added Follow-up Logic
- **AnswerEvaluator**: Evaluates candidate answers with score 0-10, returns `suggestedFollowUp` from LLM
- **InterviewSession**: Tracks `followupCount` per main question index. When evaluation score <= 3/10 OR answer is very short (< 20 chars), triggers a follow-up question. Maximum 2 follow-ups per main question, then advances to next main question.
- **InterviewOrchestrator**: `evaluateAnswer()` method checks `needsFollowup` flag from session. If follow-up needed and count < 2, generates follow-up question. After 2 follow-ups, generates next main question.

### Verification Results
- **Test count**: 60 passing (>= 46 requirement met) across 7 test files
- **Typecheck**: 0 errors
- **Lint**: 0 errors, 7 warnings (all pre-existing)

### Key Production Code Changes
- `src/lib/interview_session.ts`: Added `followupCount` Map tracking, low-score/short-answer follow-up triggers in `evaluateAnswer()` (lines ~150-175)
- `src/lib/interview_orchestrator.ts`: Added follow-up decision logic in `evaluateAnswer()` (lines ~78-112). Low score (<=3) or very short answer (<20 chars) triggers follow-up (max 2 per main question), then advances to next main question.
- `src/app/(protected)/interview/actions.ts`: Real LLMClient via `createLLMClientFromEnv()` (line 10, 57), interview status `in_progress` (lines 114-118), rollback on failure (lines 122-128)

### Files Changed (Phase C)
- `src/lib/interview_session.ts` - followupCount tracking, low-score follow-up triggers
- `src/lib/interview_orchestrator.ts` - follow-up decision logic in evaluateAnswer()
- `tests/resume/InterviewOrchestrator.test.ts` - 7 new tests: low score -> follow-up, 2 follow-ups -> next main question, last question -> completed, high score -> no follow-up
- `src/app/(protected)/interview/actions.ts` - Real LLMClient via createLLMClientFromEnv(), interview status in_progress, rollback on failure

### Proof Required
1. LLMClient created via `createLLMClientFromEnv()` at `src/app/(protected)/interview/actions.ts` line 57
2. Typed error thrown if env vars missing at actions.ts lines 58-65
3. Prompt template `MAIN_QUESTION_PROMPT_TEMPLATE` in `question_generator.ts` includes onboarding + CV data (candidate projects, skills, experience, onboarding goals, target role)
4. Interview marked `in_progress` at actions.ts lines 114-118 after first question saved
5. Interview rolled back on first-question failure at actions.ts lines 122-128
6. Follow-up logic: score <= 3 or answer < 20 chars triggers follow-up, max 2 per main question, then next main question
7. Test count: 60 passing across 7 files

### Next Move
- PROGRESS.md updated. Waiting for "continue" message.

## Question Generation Bug Fix
- Normalized LLM question strings and objects into `{ text, topic }`, with candidate-context topic defaults and strict minimum-length validation.
- Added JSON extraction for fenced/prose responses, one validation retry with correction details, and JSON-mode/schema output.
- Kept first-question generation to one question; subsequent questions are generated per submitted answer. Fallbacks are logged without candidate data, persisted as turn metadata, and shown in chat.
- Added mocked-LLM coverage for string/object responses, fenced JSON, validation retry, fallback marking, and topic derivation.
- No new Phase C work was started.

### Verification
- `npm test`: 7 test files passed, 55 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 11 warnings.
- Context7 documentation could not be fetched in this session; the installed Gemini client already uses JSON mode and a response JSON schema.

## Interview Chat UI and Completion Redirect
- Rebuilt the chat as a responsive, full-height conversation with dashboard styling, role/type header, question progress, differentiated message bubbles, fallback/follow-up labels, typing dots, and an auto-growing answer box with counter and retry.
- Added accessible end-interview confirmation; ending uses the authenticated answer API's end action and returns the same explicit completed response as the final answer.
- Final answers and manual completion show a report-ready state and navigate after 1.5 seconds, with a visible View report button. The server page checks interview ownership/status and immediately redirects completed interviews.
- Context7 MCP was unavailable. Read the installed Next.js 16.4.5 App Router docs for `redirect`, `useRouter`, and Server/Client Components; followed the project's existing Tailwind tokens and `Button`/`Card` styling.

### Verification
- `npm run lint`: exit 0, 0 errors, 11 warnings.
- `npm run typecheck`: exit 0.
- `npm test`: 7 test files passed, 55 tests passed (not below the previous total).

### Files Changed In This Task
- `src/app/(protected)/interview/[id]/chat/client.tsx`
- `src/app/(protected)/interview/[id]/chat/page.tsx`
- `src/app/api/interview/[id]/answer/route.ts`
- `PROGRESS.md`

## Interview Chat Voice Mode
- Added injectable Web Speech recognizer/synthesizer interfaces, a `VoiceController`, and the `useVoiceInterview()` hook. Recognition is available only when the browser supports `processLocally`; audio stays on-device, and synthesis selects local English voices only.
- Added the chat voice toggle, explicit mic recording and review/send controls, language selection (`en-US` / `ur-PK`), AI voice mute/replay/speed controls, speaking/listening UI, error toasts, and unsupported-browser typing guidance. Answers continue through the existing answer endpoint.
- Recognition stops before AI speech; recognition restarts after unexpected stops with a bounded retry count. Speech is sanitized before playback and cancelled on user recording, page leave, interview completion, and unmount.
- Context7 MCP tools were unavailable after tool discovery. Checked current MDN Web Speech API, SpeechRecognition on-device processing, speech synthesis voice/rate/boundary, and language documentation. The installed TypeScript DOM library includes recognition result/list types but not the recognition constructor/instance/error-event types; local structural typings cover those gaps.

### Verification
- `npm test`: 9 test files passed, 72 tests passed (baseline: 8 files, 64 tests).
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 5 pre-existing warnings (same count as baseline).

### Files Changed In This Task
- `src/app/(protected)/interview/[id]/chat/client.tsx`
- `src/app/(protected)/interview/[id]/chat/page.tsx`
- `src/lib/voice/types.ts`
- `src/lib/voice/WebSpeechRecognizer.ts`
- `src/lib/voice/WebSpeechSynthesizer.ts`
- `src/lib/voice/VoiceController.ts`
- `src/lib/voice/useVoiceInterview.ts`
- `tests/voice/VoiceController.test.ts`
- `PROGRESS.md`

## Voice Recognition Default and Language Fallback
- Removed the on-device-only `processLocally` gate. Recognition now uses the browser default and starts without calling `SpeechRecognition.available()` or `install()`.
- On `language-not-supported`, retries once using `en-US`, shows the non-blocking fallback note, then stops quietly if fallback also fails. Other recognition errors map to specific messages.
- Language mapping remains centralized in the chat page: `english` → `en-US`; `urdu_hinglish` → `ur-PK`.
- Added the browser speech-service privacy note, bottom-right five-second voice error toasts, and suppression of consecutive duplicate errors.
- Context7 MCP tools were unavailable after tool discovery. Checked MDN references for `SpeechRecognition`, BCP-47 `lang`, `processLocally`, `available()`, `install()`, and recognition error codes.

### Verification
- `npm test`: 9 test files passed, 74 tests passed (previous baseline: 72).
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 5 pre-existing warnings.

### Files Changed In This Bugfix
- `src/lib/voice/types.ts`
- `src/lib/voice/WebSpeechRecognizer.ts`
- `src/lib/voice/VoiceController.ts`
- `src/lib/voice/useVoiceInterview.ts`
- `src/app/(protected)/interview/[id]/chat/client.tsx`
- `tests/voice/VoiceController.test.ts`
- `PROGRESS.md`

## Animated Interviewer Avatar
- Added an SVG interviewer avatar with idle breathing/blinking, listening pulse, thinking indicators, speaking nod/lip movement, and reduced-motion support.
- Added `AvatarController` with injected voice events and `LipSyncEngine`; it maps recording, request wait, and speech states without coupling state logic to rendering.
- Added `WebSpeechLipSync`, driven by speech boundary events and a bounded randomized motion cycle. Mouth openness closes immediately when speech ends or is cancelled.
- Added responsive avatar/chat layout, a configurable interviewer name (defaults to Alex), a speaking-question caption, and a localStorage-only avatar visibility preference.
- Context7 docs used: Next.js 16.4.5 client components (`/vercel/next.js/v16.4.5`) and MDN CSS/SVG motion (`/mdn/content`). Also read the installed Next.js client-component guide.

### Verification
- `npm test`: 12 test files passed, 77 tests passed (up from the prior documented 74).
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 5 pre-existing warnings.

### Files Changed In This Task
- `src/app/(protected)/interview/[id]/chat/client.tsx`
- `src/components/avatar/AvatarRenderer.tsx`
- `src/components/avatar/AvatarRenderer.module.css`
- `src/lib/avatar/AvatarController.ts`
- `src/lib/avatar/LipSyncEngine.ts`
- `src/lib/avatar/WebSpeechLipSync.ts`
- `src/lib/avatar/types.ts`
- `src/lib/voice/useVoiceInterview.ts`
- `tests/avatar/AvatarController.test.ts`
- `tests/avatar/AvatarRenderer.test.ts`
- `tests/avatar/WebSpeechLipSync.test.ts`
- `PROGRESS.md`