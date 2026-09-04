import { TYPE_OPTIONS } from './defs.jsx';
import { st } from './styles.js';
import LabelStatus from './LabelStatus.jsx';

export default function MorphismPanel({ edges, nodes, sel, ctx, labelStatusOf, onSelect, onDelete, onRename, onSetType, onSetCurve }) {
  const nodeLabel = id => nodes.find(n => n.id === id)?.label ?? '?';

  return (
    <>
      <div style={st.list}>
        {edges.map(e => {
          const active = sel?.type === 'edge' && sel.id === e.id;
          return (
            <div key={e.id}
              style={{ ...st.item(active), flexDirection: 'column', alignItems: 'stretch', gap: 5 }}
              onClick={() => onSelect('edge', e.id)}>
              {/* summary row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#4db8ff', fontSize: 13, minWidth: 18, fontFamily: 'monospace' }}>→</span>
                <span style={{ color: '#c8d3ea', fontFamily: "'Crimson Text', serif", fontStyle: 'italic', fontSize: 14, flex: 1 }}>
                  {nodeLabel(e.src)} → {nodeLabel(e.tgt)}
                  {e.label && <span style={{ color: '#3d5a8a' }}> &nbsp;[{e.label}]</span>}
                </span>
                <button onClick={ev => { ev.stopPropagation(); onDelete(e.id); }} style={st.xBtn}>×</button>
              </div>

              {/* expanded editor */}
              {active && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4 }}
                  onClick={ev => ev.stopPropagation()}>

                  <Row label="label">
                    <input value={e.label} onChange={ev => onRename(e.id, ev.target.value)}
                      placeholder="f" style={st.input} />
                    <LabelStatus status={labelStatusOf?.(e.id)} ctx={ctx} />
                  </Row>

                  <Row label="type">
                    <select value={e.type} onChange={ev => onSetType(e.id, ev.target.value)}
                      style={st.select}>
                      {TYPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </Row>

                  <Row label="curve">
                    <input type="range" min={-140} max={140} value={e.curve ?? 0}
                      onChange={ev => onSetCurve(e.id, Number(ev.target.value))}
                      style={{ flex: 1 }} />
                    <span style={{ color: '#4db8ff', fontSize: 11, fontFamily: 'monospace', minWidth: 30, textAlign: 'right' }}>
                      {e.curve ?? 0}
                    </span>
                  </Row>
                </div>
              )}
            </div>
          );
        })}
        {edges.length === 0 && (
          <div style={st.empty}>No morphisms yet.<br/>Use "→ Draw" mode<br/>to create one.</div>
        )}
      </div>
    </>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ color: '#3d5a8a', fontSize: 10, fontFamily: 'monospace', minWidth: 42, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
        {children}
      </div>
    </div>
  );
}
