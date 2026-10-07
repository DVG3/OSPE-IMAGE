---
name: Ôn Tập Chạy Trạm Y Khoa
description: Neobrutalist timed OSPE station trainer with annotation authoring
colors:
  focus-yellow: "#ffdc58"
  action-blue: "#4d7cff"
  success-lime: "#b5f56e"
  alert-red: "#ff6b6b"
  support-pink: "#ff90e8"
  support-cyan: "#6de4e7"
  paper-cream: "#fbf3de"
  surface-white: "#ffffff"
  ink-black: "#000000"
typography:
  display:
    fontFamily: "'Baloo 2', 'Be Vietnam Pro', sans-serif"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  body:
    fontFamily: "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight 1.5: null
    lineHeight: 1.5
  label:
    fontFamily: "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "12px 32px"
  button-start:
    backgroundColor: "{colors.success-lime}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "16px 32px"
  button-danger:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "12px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-focus:
    backgroundColor: "{colors.focus-yellow}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: Ôn Tập Chạy Trạm Y Khoa

## Overview

**Creative North Star: "The Lab Notebook"**

A tactile training ground that feels like a well-worn lab bench: cream paper, chunky black frames, hard offset shadows that press down when touched. Every station is a notebook card pinned to the bench; the timer is the examiner's stopwatch, always visible. Bolder means stronger signal — bigger feedback, clearer hierarchy — never decoration for its own sake.

**Key Characteristics:**
- Cream paper bench (`#fbf3de`) with white cards, never gray gradients.
- 2–3px ink borders everywhere; depth comes from offset shadows, not blur.
- Signal color, not rainbow: each accent has one job.
- Chunky Vietnamese-safe type: Baloo 2 display, Be Vietnam Pro body.

## Colors

Signal colors with fixed jobs; rarity is the point.

### Primary
- **Exam Focus Yellow** (#ffdc58): current station, headers, primary highlight. Quiz header bar, station marker, start CTA hover context.

### Secondary
- **Action Blue** (#4d7cff): the thing to press. Primary buttons, selected MCQ/answer mode, links.

### Tertiary
- **Correct Lime** (#b5f56e): success only. Correct answers, score, start-CTA surface.

### Neutral
- **Bench Cream** (#fbf3de): app background.
- **Card White** (#ffffff): cards, inputs, nav.
- **Ink Black** (#000000): every border, shadow, and display text. No pure-gray text on colored surfaces.
- **Alert Red** (#ff6b6b): wrong answers, destructive actions. Always paired with label + icon, never color alone.
- **Support Pink** (#ff90e8): secondary highlight (wrong-count card, section tags).
- **Support Cyan** (#6de4e7): info/meta (counts, workspace accents, thumbnails).

### Named Rules
**The One-Job Rule.** Yellow = focus, blue = action, lime = correct, red = wrong. Never swap jobs to decorate.
**The Ink Rule.** Every surface has a 2–3px ink border; depth is `4px 4px 0 #000` offset, never blur glow.
**The Ink Text Rule.** Text on accent surfaces is always ink black — 5.6:1 on Action Blue, 7.6:1 on Alert Red. White or gray text on accents never passes AA; black-on-accent is the authentic neobrutalist pairing.

## Typography

**Display Font:** Baloo 2 (with Be Vietnam Pro fallback)
**Body Font:** Be Vietnam Pro (with system sans fallback)

**Character:** Chunky, confident headings; plain hardworking body. Vietnamese diacritics stay legible because both families ship a `vietnamese` subset — never substitute a display face without one.

### Hierarchy
- **Display** (700, 18–30px, 1.1): screen titles, station feedback ("Chính xác!"). Always uppercase with wide tracking for titles.
- **Headline** (700, 18–22px): section headers ("Chọn dữ liệu ảnh", step titles with numbered badge).
- **Title** (700, 14–16px): card titles, toolbar group labels.
- **Body** (400–500, 13–14px, 1.5): instructions, descriptions. Max ~65–75ch; never all-caps paragraphs.
- **Label** (700, 11–12px, 0.08em tracking, uppercase): field labels, counts, eyebrows.

### Named Rules
**The One Winner Rule.** One display element per viewport wins (station image > feedback > actions). Nothing else competes at display size.
**The 16px Input Floor.** Text inputs render at 16px on layouts under 768px — iOS Safari force-zooms anything smaller and breaks the exam flow. Desktop keeps the inherited size.

## Layout

Single-column drill flow on `/` (max-w-5xl exam card centered on cream bench, `p-2` mobile / `p-4` desktop). Setup stacks: source toggle → data → config → single full-width start CTA. Quiz run is three bands: timer strip → dark image stage (min 220–300px) → white answer dock (min 160–200px). LamDe/Workspace are three-pane benches (fixed left/right rails + fluid canvas center) on desktop; they must collapse to drawer + bottom thumb-zone toolbar under 768px. Spacing rhythm 8/16/24; related items 8px apart, separate groups 16–24px apart — never equal gaps everywhere.

## Elevation & Depth

Depth is structural and tactile, not ambient. Rest = hard offset shadow; hover = lift 2px with larger offset; active = press flat (`translate(2px,2px)`, shadow `0`).

### Shadow Vocabulary
- **Card rest** (`box-shadow: 4px 4px 0 #000`): exam card, `nb-card`.
- **Button rest** (`box-shadow: 3px 3px 0 #000`): `nb-btn`, `tool-btn`.
- **Button hover** (`box-shadow: 5px 5px 0 #000` + `translate(-2px,-2px)`): lift cue.
- **Hero lift** (`box-shadow: 6px 6px 0 #000`, hover `8px 8px 0`): start CTA, score cards.
- **Inset selected** (`box-shadow: inset 3px 3px 0 rgba(0,0,0,0.25)`): selected MCQ / active answer-mode.

### Named Rules
**The Press Rule.** If it looks pressable it must press: hover lifts, active flattens. Static cards never animate.

## Shapes

Squared-bold with friendly corners: cards and buttons gently rounded (8px), toggles and panels 12px, counts and chips fully pill (999px), badges and icon tiles sharp-to-slight (0–4px). Borders are always 2–3px ink; dashed 3px ink marks drop zones only. Never extreme blob radii on cards, never hairline + wide-blur combos, never purple-gradient or glassmorphism fills.

## Components

### Buttons
Tactile and confident: ink-bordered, hard-shadowed, uppercase display for primary actions.
- **Shape:** gently rounded (8px), pill (999px) only for "Câu tiếp theo".
- **Primary:** Action Blue surface, ink text, `12px 32px`.
- **Start:** Correct Lime surface, ink text, `16px 32px`, 3px border, hero lift.
- **Hover / Focus:** lift 2px + larger shadow; `:focus-visible` 3px ink outline offset 2px (global, never remove).
- **Danger:** Alert Red surface, ink text; always with icon + label.
- **Disabled:** 40% opacity, no lift, `not-allowed` cursor.

### Chips
- **Style:** pill, 2px ink border, bold 11–12px; Focus Yellow for counts, Support Cyan for meta, ink-on-lime for "Đúng", white-on-red for "Sai".
- **State:** selected mode = filled accent + inset shadow; unselected = white + hard shadow.

### Cards / Containers
- **Corner Style:** gently rounded (8px).
- **Background:** white on cream; dark `#171717` only for the quiz image stage.
- **Shadow Strategy:** card-rest offset; never nest cards more than one deep — use spacing/dividers inside.
- **Border:** 2–3px ink; dashed only for empty drop zones.
- **Internal Padding:** 12–16px cards, 24px exam shell.

### Inputs / Fields
- **Style:** white, 2px ink, 8px radius, bold text; numeric config centered.
- **Focus:** 4px Focus Yellow ring (`focus:ring-4`); no border-color swap alone.
- **Error / Disabled:** disabled = gray-200 surface, gray-400 text; errors get red-600 2px border + bold message bar, never placeholder-only.

### Navigation
White bar, 3px ink bottom border. Brand display left (uppercase, truncated), three `nb-btn` links right (uppercase 14px). Workspace adds segmented Edit/Review toggle in gray-100 well. Mobile must collapse to fewer actions — never wrap to two rows of small buttons.

### Station Progress Dots
Small squares today (10–12px) marking correct (lime) / wrong (red) / current (yellow) / upcoming (white). Must grow to ≥24px visible targets with `title="Câu N"` and a text alternative; color never the only signal.

## Do's and Don'ts

### Do:
- **Do** keep one primary action per screen (Vào thi ngay / Trả lời / Câu tiếp theo / Lưu ảnh).
- **Do** pair every red/green signal with text + icon ("Đúng"/"Sai", ✓/✕).
- **Do** use Baloo 2 for display and Be Vietnam Pro for body so Vietnamese always renders in-family.
- **Do** revoke quiz object URLs on cleanup; create them in effects, never during render.
- **Do** drive fabric zoom/pan via `viewportTransform` (`zoomToPoint`/`relativePan`), never CSS transforms.

### Don't:
- **Don't** nest cards inside cards to fake hierarchy — use spacing, dividers, type scale.
- **Don't** use gray text on accent surfaces or white text below AA without verification.
- **Don't** use `alert()`/`confirm()` for errors — use inline `nb-card` messages with recovery actions.
- **Don't** add bounce/elastic easing, auto-marquee, pulsing status dots, or decorative grid/glass backgrounds.
- **Don't** swap fonts without a `vietnamese` subset or invent testimonials/pricing/claims.
- **Don't** edit source via PowerShell `Get/Set-Content` — it double-encodes Vietnamese (mojibake). Use file tools.
