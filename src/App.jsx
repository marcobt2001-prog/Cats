import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Canvas from './Canvas.jsx';
import { useSelection } from './useSelection.js';
import { useDiagramHistory } from './useDiagramHistory.js';
import {
  fromLegacyDiagram, addObject, addMorphism, renameObject, renameMorphism, setMorphismStyle,
  moveNodes as moveNodesOp, setCurve as setCurveOp, deleteElements as deleteElementsOp,
  parallelPairs, isCommuting, toggleCommuting, commutingEdgeIds,
  extractSubdiagram, mergeDiagram,
} from './diagram/index.ts';
import { objectsOf, morphismsOf } from './math/index.ts';
import { DEFAULT_NODES, DEFAULT_EDGES } from './defaults.js';
import ObjectPanel from './ObjectPanel.jsx';
import MorphismPanel from './MorphismPanel.jsx';
import CommChecker from './CommChecker.jsx';
import AlignToolbar from './AlignToolbar.jsx';
import { CONSTRUCTIONS } from './constructions.js';
import { exportTikzCD, exportSVG, saveDiagramFile, loadDiagramFile } from './export.js';
import { st } from './styles.js';
import CollapsiblePanel from './panels/CollapsiblePanel.jsx';
import GameMode from './game/GameMode.jsx';
import WorldSelect from './game/WorldSelect.jsx';

const INITIAL_STATE = fromLegacyDiagram(DEFAULT_NODES, DEFAULT_EDGES).state;

export default function App() {
  const [appMode, setAppMode] = useState('editor'); // 'editor' | 'game-select' | 'game-play'
  const [activeLevelId, setActiveLevelId] = useState(null);

  const handleSelectLevel = (levelId) => {
    setActiveLevelId(levelId);
    setAppMode('game-play');
  };

  const handleBackToSelect = () => {
    setActiveLevelId(null);
    setAppMode('game-select');
  };

  const isGame = appMode === 'game-select' || appMode === 'game-play';

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
        {[['editor', 'editor'], ['game', 'game-select']].map(([label, target]) => {
          const active = label === 'editor' ? appMode === 'editor' : isGame;
          return (
            <button key={label} onClick={() => setAppMode(target)} style={{
              padding: '0 16px', height: 28, fontSize: 10, letterSpacing: '0.12em',
              textTransform: 'uppercase', cursor: 'pointer',
              border: `1px solid ${active ? '#4db8ff' : '#1e3a5a'}`,
              borderRadius: 4,
              background: active ? '#1e3a5a' : 'transparent',
              color: active ? '#6ee7b7' : '#4a6a8a',
              fontFamily: "'JetBrains Mono', monospace",
              transition: 'all 0.15s',
              marginRight: label === 'editor' ? 4 : 0,
            }}>{label}</button>
          );
        })}
      </div>
      {appMode === 'editor' && <Editor />}
      {appMode === 'game-select' && (
        <WorldSelect
          onSelectLevel={handleSelectLevel}
          onBackToEditor={() => setAppMode('editor')}
        />
      )}
      {appMode === 'game-play' && activeLevelId && (
        <GameMode
          key={activeLevelId}
          levelId={activeLevelId}
          onBackToSelect={handleBackToSelect}
        />
      )}
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor() {
  const { state, views, getState, apply, undo, redo, canUndo, canRedo } = useDiagramHistory(INITIAL_STATE);
  const { nodes, edges } = views;

  const selection = useSelection();
  const { sel, multiSel, selNodeIds, selEdgeIds, selectOne, setMany, clear } = selection;

  const [mode, setMode]         = useState('select');
  const [drawSrc, setDrawSrc]   = useState(null);
  const [snapOn, setSnapOn]     = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showComm, setShowComm] = useState(false);
  const [clipboard, setClipboard] = useState(null);
  const [toast, setToast]       = useState('');
  const [showConstructions, setShowConstructions] = useState(false);

  const svgRef = useRef();

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2200); };
  const nodeById = id => nodes.find(n => n.id === id);

  const commEdgeIds = useMemo(() => commutingEdgeIds(state), [state]);
  const pairs = useMemo(() => parallelPairs(state), [state]);

  // ── Diagram mutators (Canvas callbacks and panel actions) ──
  const createNode = useCallback(({ x, y }) => {
    const [next, id] = addObject(getState(), { x: x ?? 300, y: y ?? 300 });
    apply(next);
    return id;
  }, [getState, apply]);

  const createEdge = useCallback(({ src, tgt }) => {
    const [next, id] = addMorphism(getState(), { src, tgt });
    apply(next);
    return id;
  }, [getState, apply]);

  const moveNodes = useCallback((patches, opts) => apply(s => moveNodesOp(s, patches), opts), [apply]);
  const setCurve = useCallback((id, curve, opts) => apply(s => setCurveOp(s, id, curve), opts), [apply]);
  const deleteElements = useCallback(sel => apply(s => deleteElementsOp(s, sel)), [apply]);

  const renameNode = (id, name) => apply(s => renameObject(s, id, name), { coalesceKey: `label:${id}` });
  const renameEdge = (id, name) => apply(s => renameMorphism(s, id, name), { coalesceKey: `label:${id}` });
  const setEdgeType = (id, style) => apply(s => setMorphismStyle(s, id, style));
  const setEdgeCurveFromSlider = (id, curve) => setCurve(id, curve, { coalesceKey: `slider:${id}` });
  const togglePair = (src, tgt) => apply(s => toggleCommuting(s, src, tgt));

  const deleteNode = id => { deleteElements({ nodeIds: [id] }); if (selNodeIds.has(id)) clear(); };
  const deleteEdge = id => { deleteElements({ edgeIds: [id] }); if (selEdgeIds.has(id)) clear(); };

  // ── Insert construction: import the template, center it, merge with fresh ids ──
  const insertConstruction = (template) => {
    const { state: fragment, warnings } = fromLegacyDiagram(template.nodes, template.edges, template.commGroups);
    if (warnings.length) console.warn('construction template warnings', warnings);
    const rect = svgRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 400;
    const cy = rect ? rect.height / 2 : 300;
    const xs = template.nodes.map(n => n.x);
    const ys = template.nodes.map(n => n.y);
    const dx = Math.round(cx - (Math.min(...xs) + Math.max(...xs)) / 2);
    const dy = Math.round(cy - (Math.min(...ys) + Math.max(...ys)) / 2);
    const [next, ids] = mergeDiagram(getState(), fragment, { dx, dy });
    apply(next);
    setMany(ids.nodeIds, ids.edgeIds);
    setShowConstructions(false);
    showToast(`Inserted ${template.name}`);
  };

  // ── Copy / Paste ──
  const doCopy = useCallback(() => {
    const fragment = extractSubdiagram(getState(), selNodeIds, selEdgeIds);
    const nObj = objectsOf(fragment.doc.context).length;
    const nMor = morphismsOf(fragment.doc.context).length;
    if (nObj === 0 && nMor === 0) return;
    setClipboard(fragment);
    showToast(`Copied ${nObj} object(s), ${nMor} morphism(s)`);
  }, [getState, selNodeIds, selEdgeIds]);

  const doPaste = useCallback(() => {
    if (!clipboard) return;
    const [next, ids] = mergeDiagram(getState(), clipboard, { dx: 40, dy: 40 });
    apply(next);
    setMany(ids.nodeIds, ids.edgeIds);
    showToast(`Pasted ${ids.nodeIds.length} object(s), ${ids.edgeIds.length} morphism(s)`);
  }, [clipboard, getState, apply, setMany]);

  // ── Editor-level keyboard (Canvas owns Esc/1/2/3/Delete/Ctrl+A) ──
  useEffect(() => {
    const h = e => {
      const inInput = ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
      if (!inInput) {
        if (e.key === 'Escape') setShowConstructions(false);
        if (e.key === 's' && !e.ctrlKey && !e.metaKey) setSnapOn(p => !p);
        if (e.key === 'g') setShowGrid(p => !p);
      }
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
  }, [undo, redo, doCopy, doPaste]);

  const doTikzCopy = () => {
    const tikz = exportTikzCD(nodes, edges);
    navigator.clipboard.writeText(tikz).then(() => showToast('TikZ-CD copied to clipboard!'));
  };

  const doSave = () => { saveDiagramFile(getState()); showToast('Saved!'); };
  const doLoad = async () => {
    try {
      const result = await loadDiagramFile();
      if (!result) return;
      apply(result.state);
      clear();
      if (result.warnings.length) console.warn('.cat load warnings', result.warnings);
      showToast(result.warnings.length ? `Loaded (${result.warnings.length} warnings, see console)` : 'Diagram loaded');
    } catch (err) {
      console.error(err);
      showToast('Failed to load file');
    }
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
  const disabledStyle = enabled => (enabled ? {} : { opacity: 0.35, cursor: 'default' });

  const activeSel = selEdgeIds.size === 1 && selNodeIds.size === 0
    ? { type: 'edge', id: [...selEdgeIds][0] }
    : sel;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <CollapsiblePanel side="left" label="Objects" defaultOpen={true}>
        <ObjectPanel nodes={nodes} sel={sel}
          onSelect={selectOne}
          onDelete={deleteNode}
          onRename={renameNode}
          onAdd={() => { const id = createNode({}); selectOne('node', id); }} />
      </CollapsiblePanel>

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
          <button onClick={doPaste} style={{ ...st.btn, ...disabledStyle(!!clipboard) }} disabled={!clipboard} title="Ctrl+V">⎗ Paste</button>
          <button onClick={() => { if (undo()) showToast('Undo'); }} style={{ ...st.btn, ...disabledStyle(canUndo) }} disabled={!canUndo} title="Ctrl+Z">↶ Undo</button>
          <button onClick={() => { if (redo()) showToast('Redo'); }} style={{ ...st.btn, ...disabledStyle(canRedo) }} disabled={!canRedo} title="Ctrl+Shift+Z">↷ Redo</button>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#1e3256', fontSize: 9, maxWidth: 340, textAlign: 'center',
            letterSpacing: '0.04em', lineHeight: 1.6 }}>{status}</span>
          <div style={{ flex: 1 }} />
          <button onClick={doSave}     style={st.btn}>↓ Save</button>
          <button onClick={doLoad}     style={st.btn}>↑ Load</button>
          <button onClick={doTikzCopy} style={{ ...st.btn, color: '#a78bfa' }} title="Copy TikZ-CD LaTeX">TeX</button>
          <button onClick={() => exportSVG(svgRef)} style={st.btn}>SVG</button>
        </div>

        <Canvas
          nodes={nodes} edges={edges} commEdgeIds={commEdgeIds}
          selection={selection}
          mode={mode} onModeChange={setMode} drawSrc={drawSrc} onDrawSrcChange={setDrawSrc}
          snap={snapOn} showGrid={showGrid} svgRef={svgRef}
          onCreateNode={createNode} onCreateEdge={createEdge}
          onMoveNodes={moveNodes} onSetCurve={setCurve} onDelete={deleteElements} />

        {selNodeIds.size >= 2 && (
          <AlignToolbar nodes={nodes} selNodeIds={selNodeIds} onUpdateNodes={patches => moveNodes(patches)} />
        )}

        {showComm && <CommChecker nodes={nodes} edges={edges}
          pairs={pairs} isCommuting={(src, tgt) => isCommuting(state, src, tgt)} onToggle={togglePair}
          onClose={() => setShowComm(false)} />}

        {toast && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#162038', border: '1px solid #2a5498', color: '#4db8ff',
            padding: '8px 20px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
            letterSpacing: '0.06em', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            pointerEvents: 'none' }}>{toast}</div>
        )}
      </div>

      <CollapsiblePanel side="right" label="Morphisms" defaultOpen={true}>
        <MorphismPanel edges={edges} nodes={nodes} sel={activeSel}
          onSelect={selectOne}
          onDelete={deleteEdge} onRename={renameEdge} onSetType={setEdgeType} onSetCurve={setEdgeCurveFromSlider} />
      </CollapsiblePanel>
    </div>
  );
}
