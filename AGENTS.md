# AGENTS.md

Medical-station quiz trainer ("Ôn Tập Chạy Trạm Y Khoa") — React SPA ported from a legacy static HTML/JS version (history in git).

## Stack & commands

- Vite 6 + React 19 + TypeScript (strict), Tailwind CSS v4 (via `@tailwindcss/vite` plugin, no config file), fabric v7, react-router-dom v7.
- Node: use Node 20.16-compatible tooling — latest Vite 8 / @vitejs/plugin-react 6 require Node ≥20.19 and will not run here; stay on vite@^6 / plugin-react@^4.
- TypeScript is v7 (native tsgo); stricter narrowing than TS5 — compound-condition narrowing inside JSX ternaries can fail.
- `npm run dev` — dev server on :5173
- `npm run build` — runs `tsc --noEmit && vite build`; this is the lint/typecheck gate
- No test framework configured.

## Architecture

- Two routes (`src/App.tsx`): `/` = quiz app (`src/pages/QuizPage.tsx`), `/lamde` = image annotation/exam-creator tool (`src/pages/LamDePage.tsx`, fabric canvas).
- Quiz logic lives in `src/hooks/useQuizEngine.ts` (shuffle, timer, scoring) and `useImageFolders.ts` (folder parsing). Screens are dumb components in `src/components/quiz/`.
- Answer encoding convention: image filename prefix before first `_` is the correct answer (e.g. `bạch huyết cầu_01.png` → "bạch huyết cầu"). MCQ distractors are sampled from other images' answers.
- Folder inputs rely on non-standard `webkitdirectory`/`directory` attributes — passed via spread cast because React types don't include them.
- LamDe page uses browser-only APIs: File System Access API (`showDirectoryPicker`, Chrome/Edge only, download fallback elsewhere) and fabric v7 imperative API. Fabric canvas must be created/disposed in a single useEffect (StrictMode mounts effects twice in dev).
- Object URLs for quiz images are created per-question in an effect and revoked on cleanup — do not create them during render.
- `ZoomableImage` anchors itself with `absolute inset-0` — its parent must be `relative` with a size from layout (flex/min-h), never percentage heights (`h-full` collapses inside flex-grown parents whose height is content-driven).

## Conventions

- UI is neobrutalism style: black borders + hard offset shadows, cream background, accent tokens (`nb-yellow/pink/cyan/lime/blue/red`, `font-display`) defined in the Tailwind `@theme` block in `src/index.css`. Reuse `.nb-card`, `.nb-btn`, `.nb-input`, `.tool-btn` utilities there instead of restyling ad hoc.
- Fonts (Baloo 2 / Be Vietnam Pro) load from Google Fonts in `index.html`. Both are chosen for **full Vietnamese glyph coverage** — never swap in fonts without a `vietnamese` subset (e.g. Archivo Black), headings will render with mixed fallback fonts.
- UI text is Vietnamese; preserve exact wording when editing components.
- Custom keyframes/utilities (`shake`, `.nb-card`, `.nb-btn`, `.nb-input`, `.tool-btn`) live in `src/index.css`; accent color tokens (`nb-yellow/pink/cyan/lime/blue/red`) are Tailwind theme colors.
- `src/components/NavBar.tsx` is the shared nav for both routes; pages must include it or navigation dead-ends.
- Quiz settings persist to localStorage under key `ospe-settings`; wrong-answer review data comes from `useQuizEngine`'s `wrongAnswers`/`marks`.
- LamDe undo uses fabric `toJSON()` snapshots (cap 30) with a `restoringRef` guard so restores don't push new snapshots.
- LamDe zoom/pan uses fabric's `viewportTransform` (`zoomToPoint`/`relativePan`), never CSS transforms — CSS-scaling the canvas desyncs fabric pointer coords. Two-finger pinch is handled by capture-phase pointer listeners on `.canvas-container` that `stopPropagation()` to keep fabric from seeing gesture moves.
- NEVER edit source files via PowerShell `Get-Content`/`Set-Content` — PS 5.1 misreads BOM-less UTF-8 as ANSI and double-encodes all Vietnamese text (mojibake). Use the file write/edit tools instead.
- LamDe canvas fills the center viewport (ResizeObserver-sized); the image is a centered background that can be panned/zoomed beyond its bounds. `saveImage` crops to the original image rect (`imageRectRef`) with the viewport temporarily reset, so exports stay frame-clean.
