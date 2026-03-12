import { st } from './styles.js';

export default function ObjectPanel({ nodes, sel, onSelect, onDelete, onLabelChange, onAdd }) {
  return (
    <aside style={st.panel}>
      <div style={st.panelHdr}>Objects</div>
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
