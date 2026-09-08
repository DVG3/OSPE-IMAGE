import type { CanvasObjectItem, Point2D } from '../types/workspace';

export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distToSegment(p: Point2D, v: Point2D, w: Point2D): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
  });
}

/**
 * Trims/splits path strokes against an eraser circle at (cx, cy) with radius er.
 * Returns an array of remaining path segments (each being Point2D[] with at least 2 points).
 */
export function trimPathWithCircle(
  path: Point2D[],
  cx: number,
  cy: number,
  er: number
): Point2D[][] {
  if (path.length < 2) return [];

  const center: Point2D = { x: cx, y: cy };
  const result: Point2D[][] = [];
  let currentSegment: Point2D[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const dSeg = distToSegment(center, p1, p2);

    // If segment is touched by the eraser
    if (dSeg <= er) {
      if (currentSegment.length > 1) {
        result.push(currentSegment);
      }
      currentSegment = [];
    } else {
      if (currentSegment.length === 0) {
        currentSegment.push(p1);
      }
      currentSegment.push(p2);
    }
  }

  if (currentSegment.length > 1) {
    result.push(currentSegment);
  }

  return result;
}

/**
 * Calculates the visual center point of an object (for numbers/captions in Review mode)
 */
export function getObjectCenter(obj: CanvasObjectItem): Point2D {
  if (obj.type === 'dot') {
    return { x: obj.x ?? 0, y: obj.y ?? 0 };
  }
  // For highlight: average of all points across all paths
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  if (obj.paths) {
    for (const subPath of obj.paths) {
      for (const pt of subPath) {
        sumX += pt.x;
        sumY += pt.y;
        count++;
      }
    }
  }
  if (count > 0) {
    return { x: sumX / count, y: sumY / count };
  }
  return { x: 0, y: 0 };
}

const PASTEL_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#4ade80', // green
  '#2dd4bf', // teal
  '#38bdf8', // sky
  '#818cf8', // indigo
  '#c084fc', // purple
  '#f472b6', // pink
];

export function getRandomColor(): string {
  return PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
