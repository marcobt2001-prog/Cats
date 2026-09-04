// ─── Constants ────────────────────────────────────────────────────────────────
export const R = 30; // node radius
export const GRID = 40; // snap grid size

// ─── Grid snap ────────────────────────────────────────────────────────────────
export function snap(v, enabled) {
  if (!enabled) return v;
  return Math.round(v / GRID) * GRID;
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
// Purely visual: arrow paths between node positions. Graph algorithms live in
// src/math/paths.ts and ids come from the document (src/math/context.ts).
export function computeGeom(src, tgt, curve = 0) {
  if (src.id === tgt.id) {
    const x = src.x, y = src.y;
    return {
      d: `M ${x - 12} ${y - R} A 44 40 0 1 1 ${x + 12} ${y - R}`,
      lx: x, ly: y - R - 54,
      isLoop: true,
      ex: x + 12, ey: y - R,
    };
  }

  const dx = tgt.x - src.x, dy = tgt.y - src.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;

  const px = -dy / len, py = dx / len;
  const cpx = (src.x + tgt.x) / 2 + px * curve;
  const cpy = (src.y + tgt.y) / 2 + py * curve;

  const toCP = Math.hypot(cpx - src.x, cpy - src.y) || 1;
  const sx = src.x + ((cpx - src.x) / toCP) * R;
  const sy = src.y + ((cpy - src.y) / toCP) * R;

  const fromCP = Math.hypot(tgt.x - cpx, tgt.y - cpy) || 1;
  const ex = tgt.x - ((tgt.x - cpx) / fromCP) * R;
  const ey = tgt.y - ((tgt.y - cpy) / fromCP) * R;

  const mx = (sx + 2 * cpx + ex) / 4;
  const my = (sy + 2 * cpy + ey) / 4;

  return { d: `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`,
           lx: mx + px * 22, ly: my + py * 22,
           sx, sy, ex, ey, cpx, cpy, px, py };
}

export function offsetBezier(geom, off) {
  const { sx, sy, cpx, cpy, ex, ey, px, py } = geom;
  return `M ${sx+px*off} ${sy+py*off} Q ${cpx+px*off} ${cpy+py*off} ${ex+px*off} ${ey+py*off}`;
}
