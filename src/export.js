// ─── TikZ-CD export ───────────────────────────────────────────────────────────

const TIKZ_ARROW = {
  morphism: '',
  mono:     'hook',
  epi:      'two heads',
  iso:      'leftrightarrow',
  equiv:    'Leftrightarrow',
  dashed:   'dashed',
  dotted:   'dotted',
  natural:  'Rightarrow',
  exact:    'hook, two heads',
};

// Map canvas positions to a grid of (row, col) pairs
function toGrid(nodes) {
  if (nodes.length === 0) return {};
  const CELL = 90; // pixels per grid cell
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  const grid = {};
  nodes.forEach(n => {
    const col = Math.round((n.x - minX) / CELL);
    const row = Math.round((n.y - minY) / CELL);
    grid[n.id] = { row, col };
  });
  return grid;
}

// Direction string for TikZ-CD: "r", "d", "rd", "ld", etc.
function tikzDir(src, tgt, grid) {
  const s = grid[src], t = grid[tgt];
  if (!s || !t) return 'r';
  const dr = t.row - s.row;
  const dc = t.col - s.col;
  let dir = '';
  if (dr < 0) dir += 'u'.repeat(-dr);
  if (dr > 0) dir += 'd'.repeat(dr);
  if (dc < 0) dir += 'l'.repeat(-dc);
  if (dc > 0) dir += 'r'.repeat(dc);
  return dir || 'r';
}

export function exportTikzCD(nodes, edges) {
  if (nodes.length === 0) return '% empty diagram';

  const grid = toGrid(nodes);

  // Build row-major grid layout
  const maxRow = Math.max(...Object.values(grid).map(g => g.row));
  const maxCol = Math.max(...Object.values(grid).map(g => g.col));

  // Grid of node labels
  const cells = {};
  nodes.forEach(n => {
    const { row, col } = grid[n.id];
    cells[`${row},${col}`] = n;
  });

  // For each node, collect outgoing edges
  const edgesFrom = {};
  nodes.forEach(n => { edgesFrom[n.id] = []; });
  edges.forEach(e => { if (edgesFrom[e.src]) edgesFrom[e.src].push(e); });

  const rows = [];
  for (let r = 0; r <= maxRow; r++) {
    const rowCells = [];
    for (let c = 0; c <= maxCol; c++) {
      const node = cells[`${r},${c}`];
      if (!node) {
        rowCells.push('{}');
        continue;
      }
      // Collect arrow decorations
      const arrows = edgesFrom[node.id].map(e => {
        const dir = tikzDir(e.src, e.tgt, grid);
        const style = TIKZ_ARROW[e.type] || '';
        const label = e.label ? `"${e.label}"` : '';
        const parts = [dir, style, label].filter(Boolean);
        return `\\arrow[${parts.join(', ')}]`;
      });
      const arrowStr = arrows.length ? ' ' + arrows.join(' ') : '';
      rowCells.push(`${node.label}${arrowStr}`);
    }
    rows.push('    ' + rowCells.join(' & '));
  }

  const body = rows.join(' \\\\\n');

  return `\\[
\\begin{tikzcd}
${body}
\\end{tikzcd}
\\]`;
}

// ─── JSON save / load ─────────────────────────────────────────────────────────

export function serializeDiagram(nodes, edges, commGroups, meta = {}) {
  return JSON.stringify({
    version: '0.1',
    meta: { title: 'Untitled', date: new Date().toISOString(), ...meta },
    nodes,
    edges,
    commGroups: Object.fromEntries(
      Object.entries(commGroups).map(([k, v]) => [k, Array.isArray(v) ? v : [...v]])
    ),
  }, null, 2);
}

export function deserializeDiagram(json) {
  const data = JSON.parse(json);
  return {
    nodes: data.nodes || [],
    edges: data.edges || [],
    commGroups: data.commGroups || {},
    meta: data.meta || {},
  };
}

export function saveDiagramFile(nodes, edges, commGroups, filename = 'diagram.cat') {
  const json = serializeDiagram(nodes, edges, commGroups);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function loadDiagramFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.cat,.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try { resolve(deserializeDiagram(ev.target.result)); }
        catch (err) { reject(err); }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function exportSVG(svgRef) {
  const svgEl = svgRef.current;
  const data = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([data], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'diagram.svg'; a.click();
  URL.revokeObjectURL(url);
}
