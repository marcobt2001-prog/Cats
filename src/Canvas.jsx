import { useState, useEffect, useRef } from 'react';
import { R, snap as snapTo } from './geometry.js';
import { Defs } from './defs.jsx';
import Edge from './Edge.jsx';
import Node from './Node.jsx';

const EMPTY = new Set();

/**
 * The interactive SVG canvas shared by the editor and the game.
 *
 * Renders `nodes`/`edges` views and turns mouse and keyboard gestures into
 * callbacks; it owns no diagram state. Locked ids are given elements the user
 * may connect to but not move, select, edit, or delete.
 */
export default function Canvas({
  nodes, edges,
  commEdgeIds = EMPTY, lockedNodeIds = EMPTY, lockedEdgeIds = EMPTY,
  selection, mode, onModeChange, drawSrc, onDrawSrcChange,
  snap = false, showGrid = true, svgRef,
  onCreateNode, onCreateEdge, onMoveNodes, onSetCurve, onDelete,
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [dragBox, setDragBox] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [curveDrag, setCurveDrag] = useState(null);
  const gestureRef = useRef(0);

  const { selNodeIds, selEdgeIds, selectOne, toggle, setMany, clear } = selection;
  const nodeById = id => nodes.find(n => n.id === id);
  const edgeById = id => edges.find(e => e.id === id);
  const pt = e => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const nextKey = prefix => `${prefix}:${++gestureRef.current}`;

  // ── Keyboard: Esc, 1/2/3, Delete, Ctrl+A ──
  useEffect(() => {
    const h = e => {
      const inInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (inInput) return;
      if (e.key === 'Escape') { onModeChange('select'); onDrawSrcChange(null); setDragBox(null); }
      if (e.key === '1') onModeChange('select');
      if (e.key === '2') { onModeChange('addNode'); onDrawSrcChange(null); }
      if (e.key === '3') { onModeChange('addEdge'); onDrawSrcChange(null); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const nodeIds = [...selNodeIds].filter(id => !lockedNodeIds.has(id));
        const edgeIds = [...selEdgeIds].filter(id => !lockedEdgeIds.has(id));
        if (nodeIds.length > 0 || edgeIds.length > 0) {
          onDelete({ nodeIds, edgeIds });
          clear();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setMany(
          nodes.filter(n => !lockedNodeIds.has(n.id)).map(n => n.id),
          edges.filter(ed => !lockedEdgeIds.has(ed.id)).map(ed => ed.id),
        );
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [nodes, edges, selNodeIds, selEdgeIds, lockedNodeIds, lockedEdgeIds, onModeChange, onDrawSrcChange, onDelete, setMany, clear]);

  // ── Mouse on the SVG background ──
  const onSvgMouseDown = e => {
    if (e.target !== svgRef.current && !e.target.dataset.bg) return;
    if (mode === 'addNode') return;
    if (mode === 'select') {
      const p = pt(e);
      setDragBox({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, merge: e.shiftKey });
      if (!e.shiftKey) clear();
    }
  };

  const onMouseMove = e => {
    const p = pt(e);
    setMouse(p);
    if (dragging) {
      const dx = p.x - dragging.lastX, dy = p.y - dragging.lastY;
      const patches = {};
      nodes.forEach(n => {
        if ((selNodeIds.has(n.id) || n.id === dragging.id) && !lockedNodeIds.has(n.id)) {
          patches[n.id] = { x: snapTo(n.x + dx, snap), y: snapTo(n.y + dy, snap) };
        }
      });
      if (Object.keys(patches).length > 0) onMoveNodes(patches, { coalesceKey: dragging.key });
      setDragging(d => ({ ...d, lastX: p.x, lastY: p.y }));
    }
    if (dragBox) setDragBox(b => ({ ...b, x1: p.x, y1: p.y }));
    if (curveDrag) {
      const dy = p.y - curveDrag.startY;
      onSetCurve(curveDrag.edgeId, Math.round(curveDrag.startCurve - dy * 0.8), { coalesceKey: curveDrag.key });
    }
  };

  const onMouseUp = () => {
    if (dragBox) {
      const { x0, y0, x1, y1, merge } = dragBox;
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      if (Math.abs(x1 - x0) > 6 || Math.abs(y1 - y0) > 6) {
        const inBox = n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY;
        const nodeIds = nodes.filter(n => !lockedNodeIds.has(n.id) && inBox(n)).map(n => n.id);
        const edgeIds = edges.filter(ed => {
          if (lockedEdgeIds.has(ed.id)) return false;
          const src = nodeById(ed.src), tgt = nodeById(ed.tgt);
          return src && tgt && inBox(src) && inBox(tgt);
        }).map(ed => ed.id);
        setMany(nodeIds, edgeIds, { merge });
      }
      setDragBox(null);
    }
    setDragging(null); setCurveDrag(null);
  };

  const onBgClick = e => {
    if (e.target !== svgRef.current && !e.target.dataset.bg) return;
    if (mode === 'addNode') {
      const { x, y } = pt(e);
      const id = onCreateNode({ x: snapTo(x, snap), y: snapTo(y, snap) });
      if (id) selectOne('node', id);
      return;
    }
    if (!e.shiftKey) clear();
    onDrawSrcChange(null);
  };

  // ── Mouse on nodes and edges ──
  const onNodeMouseDown = (e, id) => {
    e.stopPropagation();
    if (mode === 'select') {
      if (lockedNodeIds.has(id)) return;
      if (e.shiftKey) {
        toggle('node', id);
      } else {
        if (!selNodeIds.has(id)) selectOne('node', id);
        const p = pt(e);
        setDragging({ id, lastX: p.x, lastY: p.y, key: nextKey('drag') });
      }
    } else if (mode === 'addEdge') {
      if (!drawSrc) {
        onDrawSrcChange(id);
      } else {
        const newId = onCreateEdge({ src: drawSrc, tgt: id });
        if (newId) selectOne('edge', newId);
        onDrawSrcChange(null); onModeChange('select');
      }
    }
  };

  const onEdgeClick = (e, id) => {
    e.stopPropagation();
    if (mode !== 'select' || lockedEdgeIds.has(id)) return;
    if (e.shiftKey) toggle('edge', id);
    else selectOne('edge', id);
  };

  const onCurveAdjust = (e, edgeId) => {
    e.stopPropagation();
    if (lockedEdgeIds.has(edgeId)) return;
    const edge = edgeById(edgeId);
    setCurveDrag({ edgeId, startY: pt(e).y, startCurve: edge?.curve ?? 0, key: nextKey('curve') });
  };

  // ── Transient overlays ──
  const tempEdge = () => {
    if (!drawSrc || mode !== 'addEdge') return null;
    const src = nodeById(drawSrc); if (!src) return null;
    const dx = mouse.x - src.x, dy = mouse.y - src.y, len = Math.hypot(dx, dy) || 1;
    return <line x1={src.x + (dx / len) * R} y1={src.y + (dy / len) * R} x2={mouse.x} y2={mouse.y}
      stroke="#7b92b0" strokeWidth={1.5} strokeDasharray="6 3"
      markerEnd="url(#tip-tmp)" style={{ pointerEvents: 'none' }} />;
  };

  const dragBoxRect = () => {
    if (!dragBox) return null;
    const { x0, y0, x1, y1 } = dragBox;
    return <rect x={Math.min(x0, x1)} y={Math.min(y0, y1)}
      width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)}
      fill="rgba(77,184,255,0.06)" stroke="#4db8ff" strokeWidth={1}
      strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />;
  };

  return (
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
        const locked = lockedEdgeIds.has(e.id);
        return <Edge key={e.id} edge={e} src={src} tgt={tgt}
          selected={!locked && selEdgeIds.has(e.id)} commutative={commEdgeIds.has(e.id)}
          locked={locked}
          onClick={ev => onEdgeClick(ev, e.id)}
          onCurveAdjust={ev => onCurveAdjust(ev, e.id)} />;
      })}

      {tempEdge()}
      {dragBoxRect()}

      {nodes.map(n => {
        const locked = lockedNodeIds.has(n.id);
        return <Node key={n.id} node={n}
          selected={!locked && selNodeIds.has(n.id)}
          drawSrc={drawSrc} locked={locked} onMouseDown={onNodeMouseDown} />;
      })}

      {snap && mode === 'addNode' && (
        <circle cx={snapTo(mouse.x, true)} cy={snapTo(mouse.y, true)} r={4}
          fill="none" stroke="#4db8ff" strokeWidth={1} opacity={0.4}
          style={{ pointerEvents: 'none' }} />
      )}
    </svg>
  );
}
