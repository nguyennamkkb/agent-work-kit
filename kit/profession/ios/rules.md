## Profession: iOS developer
- **Task** = one user-visible change or one fix that can be built and tested on its own (≤ 1 session). Bigger → split in the queue.
- **Done** = build green, tests green, no new compiler or SwiftLint warnings, shown in the session.
- **Priority hints:** crashes and data loss P0 · broken build/tests P0 · goal features P1 · refactors and polish P2 · nice-to-haves P3.
- **Memory worth keeping:** scheme, destination, test plan, minimum iOS, architecture pattern, concurrency mode, signing notes.

### IOS-001 · P0
Before reporting done, run the project's build + test command and show the summary (failing tests with file:line, warning count).
- Why: "done" without a green build is the most common false report.
- Check: test output appears in the session before "done".

### IOS-002 · P1
Find the scheme and simulator once (`xcodebuild -list`, `xcrun simctl list devices available`) and store them as a memory item; reuse it after that.
- Why: rediscovering build settings wastes the start of every session.
- Check: memory.md has the build command above the line.

### IOS-003 · P1
Never weaken a check to get green: no disabling tests, `// swiftlint:disable`, or lowering warning levels without an approved proposal.
- Why: hidden failures come back later and cost more.
- Check: the diff adds no disable comments or skipped tests.

### IOS-004 · P1
SwiftUI: views only lay out; state and logic live in an `@MainActor` `@Observable` model (or the project's existing pattern in memory). Inject services through protocols.
- Why: logic in views is untestable and re-renders unpredictably.
- Check: new logic has a unit test against the model, not the view.

### IOS-005 · P1
Concurrency: UI on `@MainActor`, shared mutable state in an `actor`, prefer `async let`/task groups over bare `Task {}`, store and cancel any `Task` you create. Fix the type instead of `@unchecked Sendable` or `nonisolated(unsafe)`.
- Why: silenced concurrency warnings are real data races.
- Check: no new concurrency warnings; no new unsafe annotations.

### IOS-006 · P2
Every new screen has a `#Preview` covering loading, empty, error and content states with a fake service.
- Why: previews catch layout and state bugs before running the app.
- Check: the new view file contains `#Preview`.

### IOS-007 · P1
Ask before touching signing, bundle ids, entitlements, `Info.plist` capabilities, or hand-editing `*.pbxproj`.
- Why: these break builds for the whole team and are hard to review.
- Check: none of these files change without a user confirmation in the session.
