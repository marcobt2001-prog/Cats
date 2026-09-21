/**
 * The Lean panel: what will be sent, what came back, and what it means.
 *
 * Verification takes seconds and can return a page of diagnostics, so it gets a
 * panel rather than a toast. When Lean is unavailable (a deployed build, or a
 * machine without the toolchain) the source is still shown, copyable, and
 * downloadable; only the Run button is disabled.
 */
import { useState } from 'react';
import { st } from '../styles.js';
import LeanCode from './LeanCode.jsx';
// Explicit extension: Vite will not resolve a .js specifier to a .ts file from JSX.
import { reportByGoal } from './diagnostics.ts';

const GOLD = '#f5c542';
const TEAL = '#6ee7b7';
const RED = '#ef4444';
const DIM = '#3d5a8a';

const BADGE = {
  verified: { text: '⊢ verified', color: GOLD, title: 'Lean checked this statement' },
  failed: { text: '✗ failed', color: RED, title: 'Lean rejected this statement' },
  stale: { text: '⊢ stale', color: '#8a7a3a', title: 'The diagram changed since Lean saw it; run again' },
  believed: { text: '✓ believed', color: TEAL, title: "CATS' own reasoning, which is not a proof" },
  open: { text: '○ open', color: DIM, title: 'Not yet checked' },
};

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function LeanPanel({
  source, goals, viewOf, availability, running, elapsedMs, result, error,
  onRun, onRemoveGoal, onCopy, onDownload, onClose,
}) {
  const [showRaw, setShowRaw] = useState(false);
  const available = availability?.available === true;

  const report = result ? reportByGoal({ source, goals, names: { byId: new Map(), category: '' } }, result) : null;
  const failingLines = new Set(
    (result?.diagnostics ?? [])
      .filter(d => d.severity === 'error' && d.line > 0)
      .map(d => d.line),
  );

  const banner = (() => {
    if (error) return { text: error, color: RED };
    if (!result) return null;
    if (result.raw.timedOut) return { text: `Timed out after ${seconds(result.durationMs)}`, color: RED };
    if (goals.length === 0) {
      return result.ok
        ? { text: `Context type-checks (${seconds(result.durationMs)}); no goals to prove`, color: TEAL }
        : { text: 'The context itself does not type-check', color: RED };
    }
    const passed = report.goals.filter(g => g.ok).length;
    return passed === goals.length
      ? { text: `Lean verified ${passed} of ${goals.length} in ${seconds(result.durationMs)}`, color: GOLD }
      : { text: `Lean verified ${passed} of ${goals.length}; ${goals.length - passed} failed`, color: RED };
  })();

  // Sits to the left of the Commutes panel (right: 248) so both can be open at
  // once: proving a pair there and watching the file change here is the main flow.
  return (
    <div style={{
      position: 'absolute', top: 52, left: 24, width: 520,
      background: '#0c1220', border: '1px solid #1a2540',
      borderRadius: 6, zIndex: 99, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)',
    }}>
      <div style={{ ...st.panelHdr, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Lean verification</span>
        <button onClick={onClose} style={{ ...st.xBtn, fontSize: 16 }}>×</button>
      </div>

      {/* Availability and the run control */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
        borderBottom: '1px solid #1a2540',
      }}>
        <span title={availability?.reason ?? ''} style={{
          fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 10,
          color: available ? TEAL : DIM,
          border: `1px solid ${available ? '#1a5a3a' : '#1e3256'}`,
          background: available ? '#0a1e18' : 'transparent',
        }}>
          {available ? `lean ${availability.toolchain ?? ''} · mathlib ready` : (availability?.reason ?? 'unavailable')}
        </span>
        <div style={{ flex: 1 }} />
        {running && (
          <span style={{ color: DIM, fontSize: 10, fontFamily: 'monospace' }}>
            {seconds(elapsedMs)}{elapsedMs < 20000 ? ' · first run loads Mathlib' : ''}
          </span>
        )}
        <button
          onClick={onRun}
          disabled={!available || running}
          title={available ? 'Type-check this file with Lean' : availability?.reason}
          style={{
            ...st.btn,
            color: available && !running ? GOLD : DIM,
            borderColor: available && !running ? '#5a4a1a' : '#1e3256',
            cursor: available && !running ? 'pointer' : 'default',
            opacity: available ? 1 : 0.6,
          }}>
          {running ? 'checking…' : '⊢ Run Lean'}
        </button>
      </div>

      {banner && (
        <div style={{
          padding: '8px 14px', fontSize: 11, fontFamily: 'monospace',
          color: banner.color, borderBottom: '1px solid #1a2540',
        }}>
          {banner.text}
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Goals */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #111928' }}>
          <div style={{ color: DIM, fontSize: 9, letterSpacing: '0.12em', marginBottom: 6 }}>GOALS</div>
          {goals.length === 0 && (
            <div style={{ color: '#2d4070', fontSize: 11, fontFamily: 'monospace' }}>
              No goals. Use “prove” in the Commutes panel to state one.
            </div>
          )}
          {goals.map(goal => {
            const view = viewOf(goal.id);
            const badge = BADGE[view.kind] ?? BADGE.open;
            const failure = report?.goals.find(g => g.id === goal.id);
            return (
              <div key={goal.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span title={badge.title} style={{ color: badge.color, fontSize: 10, fontFamily: 'monospace', minWidth: 78 }}>
                    {badge.text}
                  </span>
                  <span style={{ color: '#c8d3ea', fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: 14, flex: 1 }}>
                    {goal.text}
                  </span>
                  {onRemoveGoal && (
                    <button onClick={() => onRemoveGoal(goal.id)} style={st.xBtn} title="Drop this goal">×</button>
                  )}
                </div>
                {(view.kind === 'failed' || view.kind === 'stale' || failure?.message) && (
                  <div style={{ color: view.kind === 'stale' ? '#8a7a3a' : RED, fontSize: 10, fontFamily: 'monospace', paddingLeft: 86 }}>
                    {view.kind === 'stale' ? 'the diagram changed since this was checked' : (view.message ?? failure?.message)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Diagnostics */}
        {result && result.diagnostics.length > 0 && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #111928' }}>
            <div style={{ color: DIM, fontSize: 9, letterSpacing: '0.12em', marginBottom: 6 }}>LEAN OUTPUT</div>
            {result.diagnostics.map((d, i) => (
              <div key={i} style={{
                color: d.severity === 'error' ? RED : d.severity === 'warning' ? '#d6a74a' : DIM,
                fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 4,
              }}>
                {d.line > 0 ? `${d.line}:${d.col} ` : ''}{d.severity}: {d.message}
              </div>
            ))}
          </div>
        )}

        {/* The file itself */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: DIM, fontSize: 9, letterSpacing: '0.12em' }}>LEAN 4 / MATHLIB</span>
            <div style={{ flex: 1 }} />
            <button onClick={onCopy} style={{ ...st.btn, padding: '2px 8px', fontSize: 9 }}>copy</button>
            <button onClick={onDownload} style={{ ...st.btn, padding: '2px 8px', fontSize: 9 }}>download</button>
            {result && (
              <button onClick={() => setShowRaw(v => !v)} style={{ ...st.btn, padding: '2px 8px', fontSize: 9 }}>
                {showRaw ? 'hide raw' : 'raw'}
              </button>
            )}
          </div>
          <div style={{ background: '#070c18', border: '1px solid #1a2540', borderRadius: 6, padding: '12px 14px', overflowX: 'auto' }}>
            <LeanCode code={source} highlightLines={failingLines} showLineNumbers />
          </div>
          {showRaw && result && (
            <pre style={{
              marginTop: 8, padding: '10px 12px', background: '#070c18', border: '1px solid #1a2540',
              borderRadius: 6, color: '#7b92b0', fontSize: 11, whiteSpace: 'pre-wrap',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {`$ ${result.raw.command}\nexit ${result.raw.exitCode}\n${result.raw.stdout}${result.raw.stderr}` }
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
