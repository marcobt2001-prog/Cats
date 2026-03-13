import { useState, useRef, useMemo, useEffect } from 'react';
import { R, uid, computeGeom } from '../geometry.js';
import { Defs } from '../defs.jsx';
import Edge from '../Edge.jsx';
import Node from '../Node.jsx';
import { st } from '../styles.js';
import CollapsiblePanel from '../panels/CollapsiblePanel.jsx';
import ProofLog from './ProofLog.jsx';
import { useLevelState } from './LevelLoader.jsx';
import { validateGoals } from './ValidationEngine.js';
import { markLevelComplete } from './completion.js';

export default function GameMode({ levelId, onBackToSelect }) {
  const lv = useLevelState(levelId);

  if (!lv) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#3d5a8a', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
        Level not found: {levelId}
      </div>
    );
  }

  return <GameCanvas lv={lv} onBackToSelect={onBackToSelect} />;
}

function GameCanvas({ lv, onBackToSelect }) {
  const { level, nodes, edges, setNodes, setEdges, givenNodeIds, givenEdgeIds, reset } = lv;

  const [mode, setMode]       = useState('select');
  const [drawSrc, setDrawSrc] = useState(null);
  const [mouse, setMouse]     = useState({ x: 0, y: 0 });
  const [sel, setSel]         = useState(null);
  const [dragging, setDragging] = useState(null);
  const [curveDrag, setCurveDrag] = useState(null);
  const [dragBox, setDragBox] = useState(null);
  const [multiSel, setMultiSel] = useState(new Set());
  const [showHint, setShowHint] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [commEdgeIds, setCommEdgeIds] = useState(new Set());

  const svgRef = useRef();
  const completedOnceRef = useRef(false);

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

  // Validation
  const { updatedSteps, levelComplete } = useMemo(
    () => validateGoals(level.goals, nodes, edges, commEdgeIds),
    [level.goals, nodes, edges, commEdgeIds],
  );

  // Show completion overlay once and persist
  useEffect(() => {
    if (levelComplete && !completedOnceRef.current) {
      completedOnceRef.current = true;
      markLevelComplete(level.id);
      setShowComplete(true);
    }
  }, [levelComplete, level.id]);

  // Toggle commutative on an edge
  const toggleCommutative = (edgeId) => {
    setCommEdgeIds(prev => {
      const next = new Set(prev);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      return next;
    });
  };

  // Keyboard
  useEffect(() => {
    const h = e => {
      const inInput = ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName);
      if (!inInput) {
        if (e.key === 'Escape') { setMode('select'); setDrawSrc(null); setDragBox(null); }
        if (e.key === '1') setMode('select');
        if (e.key === '2') { setMode('addNode'); setDrawSrc(null); }
        if (e.key === '3') { setMode('addEdge'); setDrawSrc(null); }
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
          // Toggle commutative on selected edge
          if (sel?.type === 'edge') toggleCommutative(sel.id);
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const nIds = new Set([...selNodeIds].filter(id => !givenNodeIds.has(id)));
          const eIds = new Set([...selEdgeIds].filter(id => !givenEdgeIds.has(id)));
          if (nIds.size > 0 || eIds.size > 0) {
            setNodes(p => p.filter(n => !nIds.has(n.id)));
            setEdges(p => p.filter(ed => !eIds.has(ed.id) && !nIds.has(ed.src) && !nIds.has(ed.tgt)));
            // Also remove comm marks for deleted edges
            setCommEdgeIds(prev => {
              const next = new Set(prev);
              eIds.forEach(id => next.delete(id));
              return next;
            });
            setSel(null); setMultiSel(new Set());
          }
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selNodeIds, selEdgeIds, givenNodeIds, givenEdgeIds, sel]);

  // Mutators
  const addNode = (x, y) => {
    const label = String.fromCharCode(65 + (nodes.length % 26));
    const id = uid('obj');
    setNodes(p => [...p, { id, label, x: x ?? 300, y: y ?? 300 }]);
    setSel({ type: 'node', id }); setMultiSel(new Set());
  };

  const updateNode = (id, patch) => {
    if (givenNodeIds.has(id)) return;
    setNodes(p => p.map(n => n.id === id ? { ...n, ...patch } : n));
  };

  const updateEdge = (id, patch) => {
    if (givenEdgeIds.has(id)) return;
    setEdges(p => p.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  // SVG interaction
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
      if (givenNodeIds.has(dragging.id)) return;
      const dx = p.x - dragging.lastX, dy = p.y - dragging.lastY;
      setNodes(prev => prev.map(n =>
        n.id === dragging.id ? { ...n, x: n.x + dx, y: n.y + dy } : n
      ));
      setDragging(d => ({ ...d, lastX: p.x, lastY: p.y }));
    }
    if (dragBox) setDragBox(b => ({ ...b, x1: p.x, y1: p.y }));
    if (curveDrag) {
      if (givenEdgeIds.has(curveDrag.edgeId)) return;
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
          if (!n.locked && n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY)
            s.add('n:' + n.id);
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
      if (!givenNodeIds.has(id)) {
        setSel({ type: 'node', id }); setMultiSel(new Set());
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
    if (givenEdgeIds.has(id)) return;
    setSel({ type: 'edge', id }); setMultiSel(new Set());
  };

  const onCurveAdjust = (e, edgeId) => {
    e.stopPropagation();
    if (givenEdgeIds.has(edgeId)) return;
    const edge = edgeById(edgeId);
    setCurveDrag({ edgeId, startY: pt(e).y, startCurve: edge.curve ?? 0 });
  };

  const handleReset = () => {
    reset();
    setCommEdgeIds(new Set());
    setSel(null);
    setMultiSel(new Set());
    setDrawSrc(null);
    setMode('select');
    setShowComplete(false);
    completedOnceRef.current = false;
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

  const ModeBtn = ({ m, label }) => (
    <button onClick={() => { setMode(m); setDrawSrc(null); }}
      style={mode === m ? st.btnActive : st.btn}>{label}</button>
  );

  const status =
    mode === 'addNode' ? 'Click to place object  ·  Esc' :
    mode === 'addEdge' ? (drawSrc ? `Source: ${nodeById(drawSrc)?.label}  ·  click target` : 'Click source  ·  Esc') :
    sel?.type === 'edge' ? 'Selected  ·  C to toggle commutative  ·  Del to remove' :
    'Select · 1/2/3 modes · C commute · Del remove';

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Level title bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 16px',
          background: '#0c1220',
          borderBottom: '1px solid #1a2540',
          flexShrink: 0,
        }}>
          <button
            onClick={onBackToSelect}
            style={{
              ...st.btn,
              padding: '3px 8px',
              fontSize: 9,
              color: '#3d5a8a',
              marginRight: 4,
            }}
          >
            ← Levels
          </button>
          <span style={{
            color: '#a78bfa', fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em',
          }}>
            World {level.world} · {level.worldName}
          </span>
          <span style={{ color: '#3d5a8a', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>—</span>
          <span style={{
            color: '#c8d3ea', fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace", fontStyle: 'italic', flex: 1,
          }}>
            {level.title}
          </span>
          <span style={{
            color: '#2d4a7a', fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em',
          }}>
            Aluffi {level.aluffiRef}
          </span>
          <button
            onClick={handleReset}
            style={{
              ...st.btn,
              padding: '4px 10px',
              fontSize: 10,
              color: '#ef4444',
              borderColor: '#3b1a1a',
            }}
          >
            ↺ Reset
          </button>
          <button
            onClick={() => setShowHint(h => !h)}
            style={{
              ...st.btn,
              padding: '4px 10px',
              fontSize: 10,
              color: showHint ? '#a78bfa' : '#3d5a8a',
              borderColor: showHint ? '#a78bfa' : undefined,
            }}
          >
            ? Hint
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
          background: '#0c1220', borderBottom: '1px solid #1a2540', flexShrink: 0,
        }}>
          <span style={{ color: '#1e3256', fontSize: 9, letterSpacing: '0.12em' }}>MODE</span>
          <ModeBtn m="select"  label="✦ Select" />
          <ModeBtn m="addNode" label="○ Add" />
          <ModeBtn m="addEdge" label="→ Draw" />
          {sel?.type === 'edge' && !givenEdgeIds.has(sel.id) && (
            <>
              <div style={{ width: 1, height: 16, background: '#1a2540', margin: '0 2px' }} />
              <button
                onClick={() => toggleCommutative(sel.id)}
                style={{
                  ...(commEdgeIds.has(sel.id) ? st.btnActive : st.btn),
                  color: commEdgeIds.has(sel.id) ? '#6ee7b7' : '#3d5a8a',
                  borderColor: commEdgeIds.has(sel.id) ? '#6ee7b7' : undefined,
                }}
              >
                ∘ Commute
              </button>
            </>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ color: '#1e3256', fontSize: 9, letterSpacing: '0.04em', lineHeight: 1.6 }}>
            {status}
          </span>
        </div>

        {/* Canvas */}
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
            const isLocked = !!e.locked;
            const isComm = commEdgeIds.has(e.id) || !!e.commutative;
            return <Edge key={e.id} edge={e} src={src} tgt={tgt}
              selected={!isLocked && selEdgeIds.has(e.id)}
              commutative={isComm}
              locked={isLocked}
              onClick={ev => onEdgeClick(ev, e.id)}
              onCurveAdjust={ev => onCurveAdjust(ev, e.id)} />;
          })}

          {tempEdge()}
          {dragBoxRect()}

          {nodes.map(n => {
            const isLocked = !!n.locked;
            return <Node key={n.id} node={n}
              selected={!isLocked && selNodeIds.has(n.id)}
              drawSrc={drawSrc}
              locked={isLocked}
              onMouseDown={onNodeMouseDown} />;
          })}
        </svg>

        {/* Hint bar */}
        {showHint && level.hints && level.hints.length > 0 && (
          <div style={{
            padding: '10px 16px',
            background: '#111828',
            borderTop: '1px solid #1a2540',
            color: '#a78bfa',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontStyle: 'italic',
            lineHeight: 1.6,
            flexShrink: 0,
          }}>
            <span style={{ color: '#3d5a8a', marginRight: 8, fontStyle: 'normal' }}>HINT:</span>
            {level.hints[0]}
          </div>
        )}

        {/* Completion overlay */}
        {showComplete && <CompletionOverlay level={level} onClose={() => setShowComplete(false)} onBackToSelect={onBackToSelect} />}
      </div>

      <CollapsiblePanel side="right" label="Proof Log" defaultOpen={false}>
        <ProofLog
          given={level.proofLog.given}
          inventory={level.proofLog.inventory}
          steps={updatedSteps}
        />
      </CollapsiblePanel>
    </div>
  );
}

function CompletionOverlay({ level, onClose, onBackToSelect }) {
  const leanStub = level.leanStub || '';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,8,18,0.85)',
      zIndex: 100,
    }}>
      <div style={{
        background: '#0c1220',
        border: '1px solid #1a3a5a',
        borderRadius: 10,
        padding: '32px 36px',
        maxWidth: 560,
        width: '90%',
        boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          color: '#6ee7b7',
          fontSize: 18,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          marginBottom: 4,
        }}>
          {level.title}
        </div>
        <div style={{
          color: '#6ee7b7',
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          marginBottom: 20,
          opacity: 0.8,
        }}>
          Proof complete.
        </div>

        {leanStub && (
          <div style={{
            background: '#070c18',
            border: '1px solid #1a2540',
            borderRadius: 6,
            padding: '16px 18px',
            marginBottom: 20,
            overflowX: 'auto',
          }}>
            <div style={{
              color: '#3d5a8a', fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              Lean 4 / Mathlib
            </div>
            <LeanCode code={leanStub} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onBackToSelect} style={{
            ...st.btn,
            color: '#6ee7b7',
            borderColor: '#1a5a3a',
            padding: '8px 22px',
            fontSize: 12,
          }}>
            Continue →
          </button>
          <button onClick={onClose} style={{
            ...st.btn,
            color: '#3d5a8a',
            padding: '8px 16px',
            fontSize: 11,
          }}>
            Stay
          </button>
        </div>
      </div>
    </div>
  );
}

const LEAN_KEYWORDS = new Set([
  'import', 'variable', 'def', 'example', 'theorem', 'lemma',
  'where', 'let', 'in', 'by', 'exact', 'rfl', 'sorry',
  'open', 'namespace', 'end', 'section', 'noncomputable',
]);

function LeanCode({ code }) {
  const lines = code.split('\n');
  return (
    <pre style={{
      margin: 0,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      lineHeight: 1.7,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {lines.map((line, i) => (
        <div key={i}>{highlightLean(line)}</div>
      ))}
    </pre>
  );
}

function highlightLean(line) {
  // Comments
  if (line.trimStart().startsWith('--')) {
    return <span style={{ color: '#3d5a8a' }}>{line}</span>;
  }

  // Tokenize and highlight
  const parts = [];
  const regex = /(\b\w+\b|[^\w\s]+|\s+)/g;
  let m;
  let idx = 0;
  while ((m = regex.exec(line)) !== null) {
    const token = m[0];
    if (LEAN_KEYWORDS.has(token)) {
      parts.push(<span key={idx} style={{ color: '#4db8ff' }}>{token}</span>);
    } else if (/^[A-Z]/.test(token) && /^\w+$/.test(token)) {
      parts.push(<span key={idx} style={{ color: '#c8d3ea' }}>{token}</span>);
    } else if (/^:=?$/.test(token) || /^[{}()\[\]⟶∘]$/.test(token)) {
      parts.push(<span key={idx} style={{ color: '#7b92b0' }}>{token}</span>);
    } else {
      parts.push(<span key={idx} style={{ color: '#8899b0' }}>{token}</span>);
    }
    idx++;
  }
  return parts;
}
