import { TYPE_OPTIONS } from './defs.jsx';
import { st } from './styles.js';

export default function MorphismPanel({ edges, nodes, sel, onSelect, onDelete, onUpdate }) {
  const nodeLabel = id => nodes.find(n => n.id === id)?.label ?? '?';

  return (
    <aside style={{ ...st.panel, borderRight: 'none', borderLeft: '1px solid #1a2540' }}>
      <div style={st.panelHdr}>Morphisms</div>
      <div style={st.list}>
        {edges.map(e => {
          const active = sel?.type === 'edge' && sel.id === e.id;
          return (
            <div key={e.id}
              style={{ ...st.item(active), flexDirection: 'column', alignItems: 'stretch', gap: 5 }}
              onClick={() => onSelect({ type: 'edge', id: e.id })}>
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
                    <input value={e.label} onChange={ev => onUpdate(e.id, { label: ev.target.value })}
                      placeholder="f" style={st.input} />
                    <span style={{ color: '#3d5a8a', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>
                      LaTeX ok
                    </span>
                  </Row>

                  <Row label="type">
                    <select value={e.type} onChange={ev => onUpdate(e.id, { type: ev.target.value })}
                      style={st.select}>
                      {TYPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </Row>

                  <Row label="curve">
                    <input type="range" min={-140} max={140} value={e.curve ?? 0}
                      onChange={ev => onUpdate(e.id, { curve: Number(ev.target.value) })}
                      style={{ flex: 1 }} />
                    <span style={{ color: '#4db8ff', fontSize: 11, fontFamily: 'monospace', minWidth: 30, textAlign: 'right' }}>
                      {e.curve ?? 0}
                    </span>
                  </Row>

                  <Row label="commute">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!e.commutative}
                        onChange={ev => onUpdate(e.id, { commutative: ev.target.checked })}
                        style={{ accentColor: '#6ee7b7' }} />
                      <span style={{ color: '#6ee7b7', fontSize: 11, fontFamily: 'monospace' }}>
                        mark commutative
                      </span>
                    </label>
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
    </aside>
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
