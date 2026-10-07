# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Vietnamese medical students doing timed OSPE-style station drills ("Ôn Tập Chạy Trạm Y Khoa"). High time pressure, mixed laptop + phone, often one-handed on mobile between classes. Secondary: lecturers / teaching assistants authoring annotated exam images via LamDe and Workspace tools.

## Product Purpose

Help students build fast, accurate visual recall of anatomy / histology / clinical images under station-timer conditions. One session = complete N stations against the clock, get a /10 score, and review only what was wrong. Success = faster accurate recall, not browsing a gallery.

## Positioning

Exam-faithful drilling from the student's own image folders: filename-prefix answer encoding (`bạch huyết cầu_01.png` → "bạch huyết cầu"), timed stations, input + MCQ + click-to-identify modes, and authoring tools (LamDe, Workspace) that export frame-clean annotated images. A generic flashcard app cannot truthfully copy the station-timer + annotation-authoring loop.

## Operating Context

- Timed stations (default 30s, minimum 5s), configurable station count.
- Local-first: folders loaded via `webkitdirectory` / File System Access API (`showDirectoryPicker`, Chrome/Edge only, download fallback elsewhere). No backend, no accounts.
- Authoring: fabric-canvas annotation (LamDe) and multi-workspace anatomy annotation (Workspace edit/review modes) with `workspace.json` persistence.
- Rituals: load folders → configure → drill → review wrong answers → re-drill. Settings persist under `ospe-settings`.
- Environment: classroom, lab, dorm; noisy, interrupted, low patience for setup friction.

## Capabilities and Constraints

- Three routes: `/` quiz (flashcard + workspace engines), `/lamde` image annotation, `/workspace` anatomy workspaces.
- Quiz engines: `useQuizEngine` (input/MCQ, shuffle, timer, scoring, wrongAnswers/marks), `useWorkspaceQuizEngine` (classify/identify, click-to-identify).
- Technical constraints: Vite 6 + React 19 + TS strict (tsgo); Tailwind v4 via plugin; fabric v7 imperative API; StrictMode double-mount safe canvas lifecycle; object URLs created per-question in effects and revoked on cleanup; Node 20.16 compatible tooling (stay on vite@^6).
- Terminology: "trạm" = station, "Tự luận" = typed input, "Trắc nghiệm" = MCQ, "Phân loại cấu trúc" = classify-by-arrow, "Chọn cấu trúc" = click-to-identify.
- Undecided: sample-data onboarding content; wrong-only re-drill scope.

## Brand Commitments

Name: "Ôn Tập Chạy Trạm" / "Hệ Thống Luyện Tập Chạy Trạm". Voice: Vietnamese, direct, exam-serious with playful neobrutalist energy. Identity: neobrutalism (black borders + hard offset shadows, cream paper) is binding; fonts Baloo 2 (display) + Be Vietnam Pro (body) required for full Vietnamese glyph coverage. Never swap fonts without a `vietnamese` subset.

## Evidence on Hand

- Live routes: `src/pages/QuizPage.tsx`, `src/pages/LamDePage.tsx`, `src/pages/WorkspacePage.tsx`.
- Quiz components: `SetupScreen`, `QuizScreen`, `WorkspaceQuizScreen`, `ResultScreen`, `ZoomableImage`.
- Hooks: `useQuizEngine`, `useWorkspaceQuizEngine`, `useImageFolders`, `useWorkspaceLoader`.
- Tokens/utilities: `src/index.css` (`nb-yellow/pink/cyan/lime/blue/red`, `.nb-card/.nb-btn/.nb-input/.tool-btn`, `shake`).
- No testimonials, analytics, or brand assets to preserve; do not fabricate any.

## Product Principles

1. Calm under time pressure: one primary action per screen, timer always visible, never hide station count.
2. Exam-faithful over feature-rich: every mode maps to a real station task (recall, choose, point).
3. Local-first trust: student data never leaves the device; dirty work warns before loss.
4. Author once, drill many: annotations export frame-clean and reload as drill content.
5. Bolder within the system: amplify feedback and hierarchy without leaving neobrutalism.

## Accessibility & Inclusion

Timed tasks must remain fair: visible focus, keyboard-complete flows (Enter/1-4, shortcuts), WCAG AA contrast for text, touch targets ≥44px on mobile, motion that respects `prefers-reduced-motion`. Vietnamese diacritics must stay legible at all sizes.
