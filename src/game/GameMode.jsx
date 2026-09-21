import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Canvas from '../Canvas.jsx';
import CommChecker from '../CommChecker.jsx';
import { useSelection } from '../useSelection.js';
import {
  addObject, addMorphism, renameMorphism, moveNodes as moveNodesOp, setCurve as setCurveOp,
  deleteElements as deleteElementsOp,
  describePairs, toggleCommuting, commutingEdgeIds,
} from '../diagram/index.ts';
import { labelStatus, printLatex, printProposition } from '../math/index.ts';
import LabelStatus from '../LabelStatus.jsx';
import { generateLean, applyLeanResult, leanViewOf } from '../lean/index.ts';
import LeanPanel from '../lean/LeanPanel.jsx';
import LeanCode from '../lean/LeanCode.jsx';
import { useLeanCheck } from '../lean/useLeanCheck.js';
import { exportLean } from '../export.js';
import { st } from '../styles.js';
import CollapsiblePanel from '../panels/CollapsiblePanel.jsx';
import ProofLog from './ProofLog.jsx';
import { useLevelDiagram } from './LevelLoader.jsx';
import { validateGoals } from './ValidationEngine.js';
import { upsertLevelGoals, leanGoalId } from './leanGoals.js';
import { markLevelComplete } from './completion.js';

export default function GameMode({ levelId, onBackToSelect }) {
  const lv = useLevelDiagram(levelId);

  if (!lv.level) {
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
  const { level, history, lockedNodeIds, lockedEdgeIds, reset } = lv;
  const { state, views, getState, apply } = history;
  const { nodes, edges } = views;

  const selection = useSelection();
  const { sel, clear } = selection;

  const [mode, setMode]       = useState('select');
  const [drawSrc, setDrawSrc] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showComm, setShowComm] = useState(false);
  const [showLean, setShowLean] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const svgRef = useRef();
  const completedOnceRef = useRef(false);
  const nodeById = id => nodes.find(n => n.id === id);

  const commEdgeIds = useMemo(() => commutingEdgeIds(state), [state]);
  const pairs = useMemo(() => describePairs(state), [state]);

  // What Lean would be asked, given the diagram as it stands now.
  const lean = useLeanCheck();
  const preview = useMemo(() => {
    const withGoals = upsertLevelGoals(state, level);
    return { doc: withGoals.doc, gen: generateLean(withGoals.doc) };
  }, [state, level]);

  const leanGoals = useMemo(
    () => preview.doc.goals.map(g => ({
      id: g.id,
      text: printProposition(preview.doc.context, g.prop, 'classical'),
    })),
    [preview],
  );

  const runLean = useCallback(async () => {
    setShowLean(true);
    // State the goals first, so the verdict has something to attach to.
    apply(s => upsertLevelGoals(s, level));
    const gen = generateLean(getState().doc);
    const result = await lean.run(gen.source);
    if (result) apply(s => ({ ...s, doc: applyLeanResult(s.doc, gen, result) }));
  }, [apply, getState, lean, level]);

  // Validation
  const { updatedGoals, updatedSteps, levelComplete } = useMemo(
    () => validateGoals(level.goals, state),
    [level.goals, state],
  );

  // CATS' verdict and Lean's, side by side, one row per level goal.
  const steps = useMemo(
    () => updatedSteps.map((step, i) => {
      const levelGoal = updatedGoals[i];
      const id = levelGoal ? leanGoalId(level.id, levelGoal.id) : undefined;
      const view = id && state.doc.goals.some(g => g.id === id) ? leanViewOf(state.doc, id) : undefined;
      return view ? { ...step, lean: view } : step;
    }),
    [updatedSteps, updatedGoals, level.id, state],
  );

  // Show completion overlay once and persist
  useEffect(() => {
    if (levelComplete && !completedOnceRef.current) {
      completedOnceRef.current = true;
      markLevelComplete(level.id);
      setShowComplete(true);
    }
  }, [levelComplete, level.id]);

  // Canvas callbacks (locked ids are enforced by Canvas; ops below never receive them)
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

  const moveNodes = useCallback((patches, opts) => {
    const allowed = Object.fromEntries(Object.entries(patches).filter(([id]) => !lockedNodeIds.has(id)));
    if (Object.keys(allowed).length === 0) return;
    apply(s => moveNodesOp(s, allowed), opts);
  }, [apply, lockedNodeIds]);

  const setCurve = useCallback((id, curve, opts) => {
    if (lockedEdgeIds.has(id)) return;
    apply(s => setCurveOp(s, id, curve), opts);
  }, [apply, lockedEdgeIds]);

  const deleteElements = useCallback(({ nodeIds = [], edgeIds = [] }) => {
    const sel = {
      nodeIds: nodeIds.filter(id => !lockedNodeIds.has(id)),
      edgeIds: edgeIds.filter(id => !lockedEdgeIds.has(id)),
    };
    if (sel.nodeIds.length === 0 && sel.edgeIds.length === 0) return;
    apply(s => deleteElementsOp(s, sel));
  }, [apply, lockedNodeIds, lockedEdgeIds]);

  const togglePair = (src, tgt) => apply(s => toggleCommuting(s, src, tgt));

  const composePath = (src, tgt, expr) => {
    const cur = getState();
    const [next, id] = addMorphism(cur, { src, tgt, name: printLatex(cur.doc.context, expr) });
    apply(next);
    selection.selectOne('edge', id);
  };

  // The selected player-drawn arrow, if any: the game's one label affordance.
  const selEdge = sel?.type === 'edge' && !lockedEdgeIds.has(sel.id)
    ? edges.find(e => e.id === sel.id)
    : undefined;
  const renameEdge = (id, name) =>
    apply(s => renameMorphism(s, id, name), { coalesceKey: `label:${id}` });

  const handleReset = () => {
    reset();
    clear();
    setDrawSrc(null);
    setMode('select');
    setShowComplete(false);
    completedOnceRef.current = false;
  };

  const ModeBtn = ({ m, label }) => (
    <button onClick={() => { setMode(m); setDrawSrc(null); }}
      style={mode === m ? st.btnActive : st.btn}>{label}</button>
  );

  const status =
    mode === 'addNode' ? 'Click to place object  ·  Esc' :
    mode === 'addEdge' ? (drawSrc ? `Source: ${nodeById(drawSrc)?.label}  ·  click target` : 'Click source  ·  Esc') :
    selEdge ? 'Type a label: a name, or a composite like g \\circ f' :
    sel ? 'Selected  ·  Del to remove  ·  ∘ Commutes to assert equations' :
    'Select · 1/2/3 modes · ∘ Commutes · Del remove';

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
            style={{ ...st.btn, padding: '3px 8px', fontSize: 9, color: '#3d5a8a', marginRight: 4 }}
          >
            ← Levels
          </button>
          <span style={{ color: '#a78bfa', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>
            World {level.world} · {level.worldName}
          </span>
          <span style={{ color: '#3d5a8a', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>—</span>
          <span style={{ color: '#c8d3ea', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontStyle: 'italic', flex: 1 }}>
            {level.title}
          </span>
          <span style={{ color: '#2d4a7a', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
            Aluffi {level.aluffiRef}
          </span>
          <button
            onClick={handleReset}
            style={{ ...st.btn, padding: '4px 10px', fontSize: 10, color: '#ef4444', borderColor: '#3b1a1a' }}
          >
            ↺ Reset
          </button>
          <button
            onClick={() => setShowHint(h => !h)}
            style={{ ...st.btn, padding: '4px 10px', fontSize: 10,
              color: showHint ? '#a78bfa' : '#3d5a8a', borderColor: showHint ? '#a78bfa' : undefined }}
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
          <div style={{ width: 1, height: 16, background: '#1a2540', margin: '0 2px' }} />
          <button onClick={() => setShowComm(p => !p)}
            style={{ ...(showComm ? st.btnActive : st.btn),
              color: showComm ? '#6ee7b7' : '#3d5a8a', borderColor: showComm ? '#6ee7b7' : undefined }}>
            ∘ Commutes
          </button>
          <button onClick={() => setShowLean(p => !p)}
            title="Generate Lean and check it"
            style={{ ...(showLean ? st.btnActive : st.btn),
              color: showLean ? '#f5c542' : '#3d5a8a', borderColor: showLean ? '#f5c542' : undefined }}>
            ⊢ Lean
          </button>

          {/* Label editor for the selected player-drawn arrow. Inline on purpose:
              an inner component would be a new type each render and lose focus. */}
          {selEdge && (
            <>
              <div style={{ width: 1, height: 16, background: '#1a2540', margin: '0 2px' }} />
              <span style={{ color: '#1e3256', fontSize: 9, letterSpacing: '0.12em' }}>LABEL</span>
              <input
                value={selEdge.label}
                onChange={ev => renameEdge(selEdge.id, ev.target.value)}
                placeholder="f"
                style={{ ...st.input, width: 130 }}
              />
              <LabelStatus status={labelStatus(state.doc.context, selEdge.id)} ctx={state.doc.context} />
            </>
          )}

          <div style={{ flex: 1 }} />
          <span style={{ color: '#1e3256', fontSize: 9, letterSpacing: '0.04em', lineHeight: 1.6 }}>
            {status}
          </span>
        </div>

        <Canvas
          nodes={nodes} edges={edges} commEdgeIds={commEdgeIds}
          lockedNodeIds={lockedNodeIds} lockedEdgeIds={lockedEdgeIds}
          selection={selection}
          mode={mode} onModeChange={setMode} drawSrc={drawSrc} onDrawSrcChange={setDrawSrc}
          snap={false} showGrid={true} svgRef={svgRef}
          onCreateNode={createNode} onCreateEdge={createEdge}
          onMoveNodes={moveNodes} onSetCurve={setCurve} onDelete={deleteElements} />

        {showComm && <CommChecker
          pairs={pairs} onToggle={togglePair} onCompose={composePath}
          onClose={() => setShowComm(false)} />}

        {showLean && <LeanPanel
          source={preview.gen.source}
          goals={leanGoals}
          viewOf={id => leanViewOf(state.doc, id)}
          availability={lean.availability}
          running={lean.running}
          elapsedMs={lean.elapsedMs}
          result={lean.result}
          error={lean.error}
          onRun={runLean}
          onCopy={() => navigator.clipboard?.writeText(preview.gen.source)}
          onDownload={() => exportLean(preview.gen.source, `${level.id}.lean`)}
          onClose={() => setShowLean(false)} />}

        {/* Hint bar */}
        {showHint && level.hints && level.hints.length > 0 && (
          <div style={{
            padding: '10px 16px', background: '#111828', borderTop: '1px solid #1a2540',
            color: '#a78bfa', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            fontStyle: 'italic', lineHeight: 1.6, flexShrink: 0,
          }}>
            <span style={{ color: '#3d5a8a', marginRight: 8, fontStyle: 'normal' }}>HINT:</span>
            {level.hints[0]}
          </div>
        )}

        {/* Completion overlay */}
        {showComplete && <CompletionOverlay
          level={level}
          leanSource={preview.gen.source}
          availability={lean.availability}
          onVerify={() => { setShowComplete(false); runLean(); }}
          onClose={() => setShowComplete(false)}
          onBackToSelect={onBackToSelect} />}
      </div>

      <CollapsiblePanel side="right" label="Proof Log" defaultOpen={false}>
        <ProofLog
          given={level.proofLog.given}
          inventory={level.proofLog.inventory}
          steps={steps}
        />
      </CollapsiblePanel>
    </div>
  );
}

function CompletionOverlay({ level, leanSource, availability, onVerify, onClose, onBackToSelect }) {
  const leanAvailable = availability?.available === true;

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
          Proof complete by CATS' own reasoning. Only Lean can call it verified.
        </div>

        {leanSource && (
          <div style={{
            background: '#070c18',
            border: '1px solid #1a2540',
            borderRadius: 6,
            padding: '16px 18px',
            marginBottom: 20,
            overflowX: 'auto',
            maxHeight: 260,
          }}>
            <div style={{
              color: '#3d5a8a', fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              Lean 4 / Mathlib · generated from your diagram
            </div>
            <LeanCode code={leanSource} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onVerify}
            disabled={!leanAvailable}
            title={leanAvailable ? 'Check this with Lean' : availability?.reason}
            style={{
              ...st.btn,
              color: leanAvailable ? '#f5c542' : '#3d5a8a',
              borderColor: leanAvailable ? '#5a4a1a' : '#1e3256',
              padding: '8px 18px',
              fontSize: 12,
              cursor: leanAvailable ? 'pointer' : 'default',
              opacity: leanAvailable ? 1 : 0.6,
            }}>
            ⊢ Verify with Lean
          </button>
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
