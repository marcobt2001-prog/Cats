import { st } from './styles.js';

export default function ObjectPanel({ nodes, sel, onSelect, onDelete, onLabelChange, onAdd, collapsed, onToggle }) {
  if (collapsed) {
    return (
      <aside
        onClick={onToggle}
        style={{
          width: 28,
          background: '#0c1220',
          borderRight: '1px solid #1a2540',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'width 200ms ease',
          overflow: 'hidden',
        }}
      >
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          fontSize: 10,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: '#3d5a8a',
          fontFamily: "'JetBrains Mono', monospace",
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none',
        }}>
          <span style={{ fontSize: 8 }}>▶</span>
          Objects
        </div>
      </aside>
    );
  }

  return (
    <aside style={{ ...st.panel, transition: 'width 200ms ease' }}>
      <div style={{ ...st.panelHdr, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Objects</span>
        <span
          onClick={onToggle}
          style={{ cursor: 'pointer', fontSize: 10, color: '#3d5a8a', userSelect: 'none' }}
          title="Collapse panel"
        >◀</span>
      </div>
      <div style={st.list}>
        {nodes.map(n => {
          const active = sel?.type === 'node' && sel.id === n.id;
          return (
            <div key={n.id} style={st.item(active)}
              onClick={() => onSelect({ type: 'node', id: n.id })}>
              <span style={{ color: '#3d5a8a', fontSize: 11, fontFamily: 'monospace', minWidth: 16 }}>○</span>
              <input
                value={n.label}
                onChange={e => onLabelChange(n.id, e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="A"
                style={{ ...st.input, flex: 1 }}
              />
              <button
                onClick={e => { e.stopPropagation(); onDelete(n.id); }}
                style={st.xBtn} title="Delete">×</button>
            </div>
          );
        })}
        {nodes.length === 0 && (
          <div style={st.empty}>No objects yet.<br/>Click "+ Add Object"<br/>or use "○ Add" mode.</div>
        )}
      </div>
      <div style={st.panelFoot}>
        <button onClick={onAdd} style={{ ...st.btn, width: '100%' }}>+ Add Object</button>
      </div>
    </aside>
  );
}
