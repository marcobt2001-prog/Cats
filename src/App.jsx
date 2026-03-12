import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { R, uid, snap, computeGeom } from './geometry.js';
import { Defs } from './defs.jsx';
import Edge from './Edge.jsx';
import Node from './Node.jsx';
import ObjectPanel from './ObjectPanel.jsx';
import MorphismPanel from './MorphismPanel.jsx';
import CommChecker from './CommChecker.jsx';
import AlignToolbar from './AlignToolbar.jsx';
import { CONSTRUCTIONS } from './constructions.js';
import { exportTikzCD, exportSVG, saveDiagramFile, loadDiagramFile } from './export.js';
import { st } from './styles.js';

const DEFAULT_NODES = [
  { id: 'A', label: 'A', x: 200, y: 240 },
  { id: 'B', label: 'B', x: 540, y: 240 },
  { id: 'C', label: 'C', x: 370, y: 460 },
];
const DEFAULT_EDGES = [
  { id: 'f1', label: 'f',           src: 'A', tgt: 'B', type: 'morphism', curve: 0,   commutative: false },
  { id: 'f2', label: 'g',           src: 'B', tgt: 'C', type: 'morphism', curve: 0,   commutative: false },
  { id: 'f3', label: 'g \\circ f', src: 'A', tgt: 'C', type: 'morphism', curve: -60, commutative: false },
];

const HISTORY_CAP = 50;

export default function App() {
  const [appMode, setAppMode] = useState('editor');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0b0f1e', color: '#c8d3ea',
      fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0,
        background: '#070c18', borderBottom: '1px solid #111928',
        padding: '0 18px', height: 38, flexShrink: 0 }}>
        <span style={{ color: '#2d4a7a', fontSize: 14, fontFamily: "'Crimson Text', serif",
          fontStyle: 'italic', marginRight: 20, letterSpacing: '0.05em' }}>
          Categorical
        </span>
        {['editor', 'game'].map(m => (
          <button key={m} onClick={() => setAppMode(m)} style={{
            padding: '0 16px', height: 38, fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', cursor: 'pointer', border: 'none',
            background: appMode === m ? '#0c1220' : 'transparent',
            color: appMode === m ? '#4db8ff' : '#2d4a7a',
            borderBottom: appMode === m ? '2px solid #4db8ff' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>{m}</button>
        ))}
      </div>
      {appMode === 'editor' ? <Editor /> : <GamePlaceholder />}
    </div>
  );
}

function GamePlaceholder() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 52, opacity: 0.1 }}>⬡</div>
      <div style={{ color: '#2d4a7a', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Game Mode
      </div>
      <div style={{ color: '#1e3256', fontSize: 11, maxWidth: 360, textAlign: 'center', lineHeight: 1.9 }}>
        Diagram completion puzzles, diagram chasing, universal property challenges,
        and named theorem levels (Five Lemma, Snake Lemma, Yoneda Lemma…)
        <br /><br />Coming soon.
      </div>
    </div>
  );
}

// ─── Undo / Redo history hook ─────────────────────────────────────────────────

function useHistory(initialNodes, initialEdges) {
  const [nodes, setNodesRaw] = useState(initialNodes);
  const [edges, setEdgesRaw] = useState(initialEdges);

  const historyRef = useRef([{ nodes: initialNodes, edges: initialEdges }]);
  const indexRef = useRef(0);
  const batchRef = useRef(false);

  const pushSnapshot = useCallback((nextNodes, nextEdges) => {
    if (batchRef.current) return;
    const h = historyRef.current;
    const i = indexRef.current;
    // Trim any redo entries
    historyRef.current = h.slice(0, i + 1);
    historyRef.current.push({ nodes: nextNodes, edges: nextEdges });
    if (historyRef.current.length > HISTORY_CAP) {
      historyRef.current = historyRef.current.slice(-HISTORY_CAP);
    }
    indexRef.current = historyRef.current.length - 1;
  }, []);

  // Wrap setNodes/setEdges to auto-snapshot after state settles.
  // We use a microtask coalescing approach: batch all set* calls in the same
  // synchronous block, then push one snapshot.
  const pendingRef = useRef(null);

  const scheduleSnapshot = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = Promise.resolve().then(() => {
      pendingRef.current = null;
      // Read latest state from refs
      pushSnapshot(nodesRef.current, edgesRef.current);
    });
  }, [pushSnapshot]);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const setNodes = useCallback((updater) => {
    setNodesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      nodesRef.current = next;
      return next;
    });
    scheduleSnapshot();
  }, [scheduleSnapshot]);

  const setEdges = useCallback((updater) => {
    setEdgesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      edgesRef.current = next;
      return next;
    });
    scheduleSnapshot();
  }, [scheduleSnapshot]);

  // Batch multiple set calls into one snapshot
  const batch = useCallback((fn) => {
    batchRef.current = true;
    fn();
    batchRef.current = false;
    scheduleSnapshot();
  }, [scheduleSnapshot]);

  const undo = useCallback(() => {
    const i = indexRef.current;
    if (i <= 0) return false;
    indexRef.current = i - 1;
    const snap = historyRef.current[i - 1];
    batchRef.current = true;
    setNodesRaw(snap.nodes);
    setEdgesRaw(snap.edges);
    nodesRef.current = snap.nodes;
    edgesRef.current = snap.edges;
    batchRef.current = false;
    return true;
  }, []);

  const redo = useCallback(() => {
    const i = indexRef.current;
    if (i >= historyRef.current.length - 1) return false;
    indexRef.current = i + 1;
    const snap = historyRef.current[i + 1];
    batchRef.current = true;
    setNodesRaw(snap.nodes);
    setEdgesRaw(snap.edges);
    nodesRef.current = snap.nodes;
    edgesRef.current = snap.edges;
    batchRef.current = false;
    return true;
  }, []);

  const canUndo = () => indexRef.current > 0;
  const canRedo = () => indexRef.current < historyRef.current.length - 1;

  return { nodes, edges, setNodes, setEdges, batch, undo, redo, canUndo, canRedo };
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor() {
  const { nodes, edges, setNodes, setEdges, batch, undo, redo, canUndo, canRedo } =
    useHistory(DEFAULT_NODES, DEFAULT_EDGES);

  const [mode, setMode]         = useState('select');
  const [drawSrc, setDrawSrc]   = useState(null);
  const [mouse, setMouse]       = useState({ x: 0, y: 0 });
  const [snapOn, setSnapOn]     = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showComm, setShowComm] = useState(false);
  const [commGroups, setCommGroups] = useState({});
  const [sel, setSel]           = useState(null);
  const [multiSel, setMultiSel] = useState(new Set());
  const [dragBox, setDragBox]   = useState(null);
  const [dragging, setDragging] = useState(null);
  const [curveDrag, setCurveDrag] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [toast, setToast]       = useState('');
  const [showConstructions, setShowConstructions] = useState(false);

  const svgRef = useRef();

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const pt = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nodeById = id => nodes.find(n => n.id === id);
  const edgeById = id => edges.find(e => e.id === id);

  const selNodeIds = useMemo(() => {
    const s = new Set();
    multiSel.forEach(k => { if (k.startsWith('n:')) s.add(k.slice(2)); });
    if (sel?.type === 'node') s.add(sel.id);
    return s;
  }, [multiSel, sel]);

  const selEdgeIds = useMemo(() => {
    const s = new Set();
    multiSel.forEach(k => { if (k.startsWith('e:')) s.add(k.slice(2)); });
    if (sel?.type === 'edge') s.add(sel.id);
    return s;
  }, [multiSel, sel]);

  const commEdgeIds = useMemo(() => {
    const s = new Set();
    Object.values(commGroups).forEach(ids => ids.forEach(id => s.add(id)));
    edges.forEach(e => { if (e.commutative) s.add(e.id); });
    return s;
  }, [commGroups, edges]);

  // ── Keyboard ──
  useEffect(() => {
    const h = e => {
      const inInput = ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName);
      if (!inInput) {
        if (e.key === 'Escape') { setMode('select'); setDrawSrc(null); setDragBox(null); setShowConstructions(false); }
        if (e.key === '1') setMode('select');
        if (e.key === '2') { setMode('addNode'); setDrawSrc(null); }
        if (e.key === '3') { setMode('addEdge'); setDrawSrc(null); }
        if (e.key === 's' && !e.ctrlKey && !e.metaKey) setSnapOn(p => !p);
        if (e.key === 'g') setShowGrid(p => !p);
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const nIds = selNodeIds; const eIds = selEdgeIds;
          if (nIds.size > 0 || eIds.size > 0) {
            batch(() => {
              setNodes(p => p.filter(n => !nIds.has(n.id)));
              setEdges(p => p.filter(ed => !eIds.has(ed.id) && !nIds.has(ed.src) && !nIds.has(ed.tgt)));
            });
            setSel(null); setMultiSel(new Set());
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          e.preventDefault();
          const s = new Set();
          nodes.forEach(n => s.add('n:' + n.id));
          edges.forEach(ed => s.add('e:' + ed.id));
          setMultiSel(s); setSel(null);
        }
      }
      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undo()) showToast('Undo');
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (redo()) showToast('Redo');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') doCopy();
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') doPaste();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, multiSel, nodes, edges, selNodeIds, selEdgeIds, clipboard, undo, redo, batch]);

  // ── Mutators ──
  const deleteNode = id => {
    batch(() => {
      setNodes(p => p.filter(n => n.id !== id));
      setEdges(p => p.filter(e => e.src !== id && e.tgt !== id));
    });
    if (sel?.id === id) setSel(null);
  };
  const deleteEdge = id => {
    setEdges(p => p.filter(e => e.id !== id));
    if (sel?.id === id) setSel(null);
  };
  const updateNode = (id, patch) => setNodes(p => p.map(n => n.id === id ? { ...n, ...patch } : n));
  const updateEdge = (id, patch) => setEdges(p => p.map(e => e.id === id ? { ...e, ...patch } : e));

  const addNode = (x, y) => {
    const label = String.fromCharCode(65 + (nodes.length % 26));
    const id = uid('obj');
    setNodes(p => [...p, { id, label, x: snap(x ?? 300, snapOn), y: snap(y ?? 300, snapOn) }]);
    setSel({ type: 'node', id }); setMultiSel(new Set());
  };

  // ── Batch update multiple nodes (for alignment) ──
  const batchUpdateNodes = (patches) => {
    setNodes(p => p.map(n => patches[n.id] ? { ...n, ...patches[n.id] } : n));
  };

  // ── Insert construction ──
  const insertConstruction = (template) => {
    const { nodes: tplNodes, edges: tplEdges } = template.build();
    // Center in viewport
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 400;
    const cy = rect ? rect.height / 2 : 300;
    // Compute template center
    const txs = tplNodes.map(n => n.x);
    const tys = tplNodes.map(n => n.y);
    const tcx = (Math.min(...txs) + Math.max(...txs)) / 2;
    const tcy = (Math.min(...tys) + Math.max(...tys)) / 2;
    const ox = Math.round(cx - tcx);
    const oy = Math.round(cy - tcy);
    const offsetNodes = tplNodes.map(n => ({ ...n, x: n.x + ox, y: n.y + oy }));
    batch(() => {
      setNodes(p => [...p, ...offsetNodes]);
      setEdges(p => [...p, ...tplEdges]);
    });
    // Select the new nodes
    const s = new Set();
    offsetNodes.forEach(n => s.add('n:' + n.id));
    tplEdges.forEach(e => s.add('e:' + e.id));
    setMultiSel(s); setSel(null);
    setShowConstructions(false);
    showToast(`Inserted ${template.name}`);
  };

  // ── Copy / Paste ──
  const doCopy = useCallback(() => {
    const nodeIds = selNodeIds.size > 0 ? selNodeIds : (sel?.type === 'node' ? new Set([sel.id]) : new Set());
    const edgeIds = selEdgeIds.size > 0 ? selEdgeIds : (sel?.type === 'edge' ? new Set([sel.id]) : new Set());
    const copiedNodes = nodes.filter(n => nodeIds.has(n.id));
    const copiedEdges = edges.filter(e => edgeIds.has(e.id) || (nodeIds.has(e.src) && nodeIds.has(e.tgt)));
    if (copiedNodes.length === 0 && copiedEdges.length === 0) return;
    setClipboard({ nodes: copiedNodes, edges: copiedEdges });
    showToast(`Copied ${copiedNodes.length} object(s), ${copiedEdges.length} morphism(s)`);
  }, [sel, selNodeIds, selEdgeIds, nodes, edges]);

  const doPaste = useCallback(() => {
    if (!clipboard) return;
    const idMap = {};
    const newNodes = clipboard.nodes.map(n => {
      const newId = uid('obj'); idMap[n.id] = newId;
      return { ...n, id: newId, x: n.x + 40, y: n.y + 40 };
    });
    const newEdges = clipboard.edges.map(e => ({
      ...e, id: uid('e'), src: idMap[e.src] ?? e.src, tgt: idMap[e.tgt] ?? e.tgt,
    }));
    batch(() => {
      setNodes(p => [...p, ...newNodes]);
      setEdges(p => [...p, ...newEdges]);
    });
    const s = new Set();
    newNodes.forEach(n => s.add('n:' + n.id));
    newEdges.forEach(e => s.add('e:' + e.id));
    setMultiSel(s); setSel(null);
    showToast(`Pasted ${newNodes.length} object(s), ${newEdges.length} morphism(s)`);
  }, [clipboard, batch]);

  // ── SVG interaction ──
  const onSvgMouseDown = e => {
    if (e.target !== svgRef.current && !e.target.dataset.bg) return;
    if (mode === 'addNode') return;
    if (mode === 'select') {
      const p = pt(e);
      setDragBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      if (!e.shiftKey) { setSel(null); setMultiSel(new Set()); }
    }
  };

  const onMouseMove = e => {
    const p = pt(e);
    setMouse(p);
    if (dragging) {
      const dx = p.x - dragging.lastX, dy = p.y - dragging.lastY;
      setNodes(prev => prev.map(n =>
        (selNodeIds.has(n.id) || n.id === dragging.id)
          ? { ...n, x: snap(n.x + dx, snapOn), y: snap(n.y + dy, snapOn) }
          : n
      ));
      setDragging(d => ({ ...d, lastX: p.x, lastY: p.y }));
    }
    if (dragBox) setDragBox(b => ({ ...b, x1: p.x, y1: p.y }));
    if (curveDrag) {
      const dy = p.y - curveDrag.startY;
      updateEdge(curveDrag.edgeId, { curve: Math.round(curveDrag.startCurve - dy * 0.8) });
    }
  };

  const onMouseUp = () => {
    if (dragBox) {
      const { x0, y0, x1, y1 } = dragBox;
      const minX = Math.min(x0,x1), maxX = Math.max(x0,x1);
      const minY = Math.min(y0,y1), maxY = Math.max(y0,y1);
      if (Math.abs(x1-x0) > 6 || Math.abs(y1-y0) > 6) {
        const s = new Set(multiSel);
        nodes.forEach(n => {
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) s.add('n:' + n.id);
        });
        edges.forEach(ed => {
          const src = nodeById(ed.src), tgt = nodeById(ed.tgt);
          if (src && tgt &&
            src.x >= minX && src.x <= maxX && src.y >= minY && src.y <= maxY &&
            tgt.x >= minX && tgt.x <= maxX && tgt.y >= minY && tgt.y <= maxY)
            s.add('e:' + ed.id);
        });
        setMultiSel(s);
      }
      setDragBox(null);
    }
    setDragging(null); setCurveDrag(null);
  };

  const onBgClick = e => {
    if (e.target !== svgRef.current && !e.target.dataset.bg) return;
    if (mode === 'addNode') { const { x, y } = pt(e); addNode(x, y); return; }
    if (!e.shiftKey) { setSel(null); setMultiSel(new Set()); }
    setDrawSrc(null);
  };

  const onNodeMouseDown = (e, id) => {
    e.stopPropagation();
    if (mode === 'select') {
      if (e.shiftKey) {
        setMultiSel(prev => { const s = new Set(prev); const k = 'n:'+id; s.has(k) ? s.delete(k) : s.add(k); return s; });
        setSel(null);
      } else {
        if (!selNodeIds.has(id)) { setSel({ type: 'node', id }); setMultiSel(new Set()); }
        const p = pt(e);
        setDragging({ id, lastX: p.x, lastY: p.y });
      }
    } else if (mode === 'addEdge') {
      if (!drawSrc) { setDrawSrc(id); }
      else {
        const newEdge = { id: uid('e'), label: '', src: drawSrc, tgt: id, type: 'morphism', curve: 0, commutative: false };
        setEdges(p => [...p, newEdge]);
        setSel({ type: 'edge', id: newEdge.id }); setMultiSel(new Set());
        setDrawSrc(null); setMode('select');
      }
    }
  };

  const onEdgeClick = (e, id) => {
    e.stopPropagation();
    if (mode !== 'select') return;
    if (e.shiftKey) {
      setMultiSel(prev => { const s = new Set(prev); const k = 'e:'+id; s.has(k) ? s.delete(k) : s.add(k); return s; });
      setSel(null);
    } else { setSel({ type: 'edge', id }); setMultiSel(new Set()); }
  };

  const onCurveAdjust = (e, edgeId) => {
    e.stopPropagation();
    const edge = edgeById(edgeId);
    setCurveDrag({ edgeId, startY: pt(e).y, startCurve: edge.curve ?? 0 });
  };

  const toggleCommGroup = (gk, edgeIds) => {
    setCommGroups(prev => { const n = { ...prev }; n[gk] ? delete n[gk] : (n[gk] = edgeIds); return n; });
  };

  const doTikzCopy = () => {
    const tikz = exportTikzCD(nodes, edges);
    navigator.clipboard.writeText(tikz).then(() => showToast('TikZ-CD copied to clipboard!'));
  };

  const doSave = () => { saveDiagramFile(nodes, edges, commGroups); showToast('Saved!'); };
  const doLoad = async () => {
    try {
      const data = await loadDiagramFile();
      batch(() => {
        setNodes(data.nodes);
        setEdges(data.edges);
      });
      setCommGroups(data.commGroups);
      setSel(null); setMultiSel(new Set()); showToast('Diagram loaded');
    } catch { showToast('Failed to load file'); }
  };

  const tempEdge = () => {
    if (!drawSrc || mode !== 'addEdge') return null;
    const src = nodeById(drawSrc); if (!src) return null;
    const dx = mouse.x - src.x, dy = mouse.y - src.y, len = Math.hypot(dx,dy) || 1;
    return <line x1={src.x+(dx/len)*R} y1={src.y+(dy/len)*R} x2={mouse.x} y2={mouse.y}
      stroke="#7b92b0" strokeWidth={1.5} strokeDasharray="6 3"
      markerEnd="url(#tip-tmp)" style={{ pointerEvents: 'none' }} />;
  };

  const dragBoxRect = () => {
    if (!dragBox) return null;
    const { x0, y0, x1, y1 } = dragBox;
    return <rect x={Math.min(x0,x1)} y={Math.min(y0,y1)}
      width={Math.abs(x1-x0)} height={Math.abs(y1-y0)}
      fill="rgba(77,184,255,0.06)" stroke="#4db8ff" strokeWidth={1}
      strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />;
  };

  const hasMulti = multiSel.size > 0;
  const status =
    mode === 'addNode' ? 'Click canvas to place object  ·  Esc to cancel' :
    mode === 'addEdge' ? (drawSrc ? `Source: ${nodeById(drawSrc)?.label}  ·  click target  ·  Esc` : 'Click source object  ·  Esc to cancel') :
    hasMulti ? `${selNodeIds.size} obj · ${selEdgeIds.size} morph selected  ·  Ctrl+C  ·  Del` :
    'Select · Shift multi · 1/2/3 modes · s snap · g grid · Ctrl+Z undo · Ctrl+A all';

  const ModeBtn = ({ m, label }) => (
    <button onClick={() => { setMode(m); setDrawSrc(null); }}
      style={mode === m ? st.btnActive : st.btn}>{label}</button>
  );
  const TogBtn = ({ active, onClick, label, color = '#4db8ff' }) => (
    <button onClick={onClick} style={{ ...(active ? st.btnActive : st.btn),
      color: active ? color : '#3d5a8a', borderColor: active ? color : undefined }}>{label}</button>
  );

  const activeSel = selEdgeIds.size === 1 && selNodeIds.size === 0
    ? { type: 'edge', id: [...selEdgeIds][0] }
    : sel;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <ObjectPanel nodes={nodes} sel={sel}
        onSelect={id => { setSel({ type: 'node', id }); setMultiSel(new Set()); }}
        onDelete={deleteNode}
        onLabelChange={(id, v) => updateNode(id, { label: v })}
        onAdd={() => addNode()} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px',
          background: '#0c1220', borderBottom: '1px solid #1a2540', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ color: '#1e3256', fontSize: 9, letterSpacing: '0.12em' }}>MODE</span>
          <ModeBtn m="select"  label="✦ Select" />
          <ModeBtn m="addNode" label="○ Add" />
          <ModeBtn m="addEdge" label="→ Draw" />
          <div style={{ width: 1, height: 16, background: '#1a2540', margin: '0 2px' }} />
          <TogBtn active={snapOn}   onClick={() => setSnapOn(p=>!p)}   label="⊞ Snap" />
          <TogBtn active={showGrid} onClick={() => setShowGrid(p=>!p)} label="⋮ Grid" />
          <TogBtn active={showComm} onClick={() => setShowComm(p=>!p)} label="∘ Commutes" color="#6ee7b7" />
          <div style={{ width: 1, height: 16, background: '#1a2540', margin: '0 2px' }} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowConstructions(p => !p)}
              style={{ ...(showConstructions ? st.btnActive : st.btn), color: '#a78bfa' }}>
              ⊕ Insert
            </button>
            {showConstructions && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 200,
                background: '#0c1220', border: '1px solid #1a2540', borderRadius: 6,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)', width: 260, maxHeight: 380, overflowY: 'auto',
              }}>
                <div style={{ ...st.panelHdr, padding: '8px 12px' }}>Common Constructions</div>
                {CONSTRUCTIONS.map((tpl, i) => (
                  <div key={i}
                    onClick={() => insertConstruction(tpl)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
                      borderBottom: '1px solid #111928',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#162038'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: '#a78bfa', fontSize: 14, minWidth: 32, textAlign: 'center',
                      fontFamily: 'monospace' }}>{tpl.symbol}</span>
                    <div>
                      <div style={{ color: '#c8d3ea', fontSize: 12 }}>{tpl.name}</div>
                      <div style={{ color: '#3d5a8a', fontSize: 10, marginTop: 1 }}>{tpl.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 16, background: '#1a2540', margin: '0 2px' }} />
          <button onClick={doCopy}  style={st.btn} title="Ctrl+C">⎘ Copy</button>
          <button onClick={doPaste} style={st.btn} title="Ctrl+V">⎗ Paste</button>
          <button onClick={() => { if (undo()) showToast('Undo'); }} style={st.btn} title="Ctrl+Z">↶ Undo</button>
          <button onClick={() => { if (redo()) showToast('Redo'); }} style={st.btn} title="Ctrl+Shift+Z">↷ Redo</button>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#1e3256', fontSize: 9, maxWidth: 340, textAlign: 'center',
            letterSpacing: '0.04em', lineHeight: 1.6 }}>{status}</span>
          <div style={{ flex: 1 }} />
          <button onClick={doSave}     style={st.btn}>↓ Save</button>
          <button onClick={doLoad}     style={st.btn}>↑ Load</button>
          <button onClick={doTikzCopy} style={{ ...st.btn, color: '#a78bfa' }} title="Copy TikZ-CD LaTeX">TeX</button>
          <button onClick={() => exportSVG(svgRef)} style={st.btn}>SVG</button>
        </div>

        <svg ref={svgRef}
          style={{ flex: 1, cursor: mode === 'addNode' ? 'crosshair' : 'default', display: 'block' }}
          onMouseDown={onSvgMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onClick={onBgClick}>
          <Defs />
          <rect data-bg="1" width="100%" height="100%" fill="#0b0f1e" />
          {showGrid && <rect data-bg="1" width="100%" height="100%" fill="url(#grid)" />}

          {edges.map(e => {
            const src = nodeById(e.src), tgt = nodeById(e.tgt);
            if (!src || !tgt) return null;
            return <Edge key={e.id} edge={e} src={src} tgt={tgt}
              selected={selEdgeIds.has(e.id)} commutative={commEdgeIds.has(e.id)}
              onClick={ev => onEdgeClick(ev, e.id)}
              onCurveAdjust={ev => onCurveAdjust(ev, e.id)} />;
          })}

          {tempEdge()}
          {dragBoxRect()}

          {nodes.map(n => (
            <Node key={n.id} node={n}
              selected={selNodeIds.has(n.id)}
              drawSrc={drawSrc} onMouseDown={onNodeMouseDown} />
          ))}

          {snapOn && mode === 'addNode' && (
            <circle cx={snap(mouse.x,true)} cy={snap(mouse.y,true)} r={4}
              fill="none" stroke="#4db8ff" strokeWidth={1} opacity={0.4}
              style={{ pointerEvents: 'none' }} />
          )}
        </svg>

        {selNodeIds.size >= 2 && (
          <AlignToolbar nodes={nodes} selNodeIds={selNodeIds} onUpdateNodes={batchUpdateNodes} />
        )}

        {showComm && <CommChecker nodes={nodes} edges={edges}
          commGroups={commGroups} onToggleGroup={toggleCommGroup}
          onClose={() => setShowComm(false)} />}

        {toast && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#162038', border: '1px solid #2a5498', color: '#4db8ff',
            padding: '8px 20px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
            letterSpacing: '0.06em', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            pointerEvents: 'none' }}>{toast}</div>
        )}
      </div>

      <MorphismPanel edges={edges} nodes={nodes} sel={activeSel}
        onSelect={id => { setSel({ type: 'edge', id }); setMultiSel(new Set()); }}
        onDelete={deleteEdge} onUpdate={updateEdge} />
    </div>
  );
}
