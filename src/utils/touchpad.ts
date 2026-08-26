// Heuristic touchpad detection: touchpads emit frequent small pixel-delta wheel
// events, while mouse wheels emit large discrete steps (typically ±100+).
// Used to soften drag-pan speed for touchpad users (drag itself is otherwise
// indistinguishable from a mouse at the pointer-event level).

const TOUCHPAD_WHEEL_MAX_DELTA = 40;
const TOUCHPAD_ACTIVE_MS = 2000;

let touchpadActiveUntil = 0;

export const TOUCHPAD_DRAG_FACTOR = 0.5;

export function markWheelSource(e: WheelEvent): void {
  if (e.deltaMode === 0 && Math.abs(e.deltaY) > 0 && Math.abs(e.deltaY) < TOUCHPAD_WHEEL_MAX_DELTA) {
    touchpadActiveUntil = Date.now() + TOUCHPAD_ACTIVE_MS;
  }
}

export function isTouchpadActive(): boolean {
  return Date.now() < touchpadActiveUntil;
}
