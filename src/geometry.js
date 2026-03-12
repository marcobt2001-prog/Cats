// ─── Constants ────────────────────────────────────────────────────────────────
export const R = 30; // node radius
export const GRID = 40; // snap grid size

// ─── ID generation ────────────────────────────────────────────────────────────
let _uid = 1;
export const uid = (p = 'n') => `${p}${_uid++}`;

// ─── Grid snap ────────────────────────────────────────────────────────────────
export function snap(v, enabled) {
  if (!enabled) return v;
  return Math.round(v / GRID) * GRID;
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
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

// ─── Graph algorithms for commutativity ──────────────────────────────────────

// Find all simple paths from `start` to `end` in the directed graph
export function findAllPaths(start, end, edges, nodes) {
  const nodeIds = new Set(nodes.map(n => n.id));
  const adj = {};
  nodeIds.forEach(id => { adj[id] = []; });
  edges.forEach(e => { if (adj[e.src]) adj[e.src].push({ tgt: e.tgt, edgeId: e.id, label: e.label }); });

  const results = [];
  const visited = new Set();

  function dfs(cur, path, labels) {
    if (cur === end) {
      results.push({ path: [...path], labels: [...labels] });
      return;
    }
    visited.add(cur);
    for (const { tgt, edgeId, label } of (adj[cur] || [])) {
      if (!visited.has(tgt)) dfs(tgt, [...path, edgeId], [...labels, label]);
    }
    visited.delete(cur);
  }

  dfs(start, [], []);
  return results;
}

// Detect all minimal cycles (node triples/quads) that could form commutative squares
export function detectCycles(nodes, edges) {
  const nodeIds = nodes.map(n => n.id);
  const adj = {};
  nodeIds.forEach(id => { adj[id] = new Set(); });
  edges.forEach(e => { if (adj[e.src]) adj[e.src].add(e.tgt); });

  const triangles = [];
  const squares = [];

  // Triangles: A→B, A→C, B→C (or A→B→C and A→C)
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = 0; j < nodeIds.length; j++) {
      if (i === j) continue;
      for (let k = 0; k < nodeIds.length; k++) {
        if (k === i || k === j) continue;
        const a = nodeIds[i], b = nodeIds[j], c = nodeIds[k];
        if (adj[a].has(b) && adj[b].has(c) && adj[a].has(c)) {
          const key = [a,b,c].sort().join('|');
          if (!triangles.find(t => t.key === key)) {
            triangles.push({ key, nodes: [a,b,c] });
          }
        }
      }
    }
  }

  // Squares: A→B, A→C, B→D, C→D
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = 0; j < nodeIds.length; j++) {
      if (i === j) continue;
      for (let k = 0; k < nodeIds.length; k++) {
        if (k === i || k === j) continue;
        for (let l = 0; l < nodeIds.length; l++) {
          if (l === i || l === j || l === k) continue;
          const a = nodeIds[i], b = nodeIds[j], c = nodeIds[k], d = nodeIds[l];
          if (adj[a].has(b) && adj[a].has(c) && adj[b].has(d) && adj[c].has(d)
              && !adj[a].has(d)) {
            const key = [a,b,c,d].sort().join('|');
            if (!squares.find(s => s.key === key)) {
              squares.push({ key, nodes: [a,b,c,d] });
            }
          }
        }
      }
    }
  }

  return { triangles, squares };
}
