import { st } from './styles.js';

/**
 * Lists every pair of objects joined by two or more paths and lets the user
 * assert that the paths are equal. Purely presentational: `pairs` comes from
 * `parallelPairs(state)`, `isCommuting(src, tgt)` and `onToggle(src, tgt)`
 * from the owner.
 */
export default function CommChecker({ nodes, edges, pairs, isCommuting, onToggle, onClose }) {
  const nodeLabel = id => nodes.find(n => n.id === id)?.label ?? id;
  const edgeLabel = id => edges.find(e => e.id === id)?.label || '—';

  return (
    <div style={{
      position: 'absolute', top: 52, right: 248, width: 320,
      background: '#0c1220', border: '1px solid #1a2540',
      borderRadius: 6, zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)',
    }}>
      <div style={{ ...st.panelHdr, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Commutativity Checker</span>
        <button onClick={onClose} style={{ ...st.xBtn, fontSize: 16 }}>×</button>
      </div>

      <div style={{ padding: '10px 14px', color: '#3d5a8a', fontSize: 11, fontFamily: 'monospace',
        borderBottom: '1px solid #1a2540', lineHeight: 1.6 }}>
        Pairs with multiple paths. Mark a pair to assert that its paths are equal (highlights edges in teal).
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {pairs.length === 0 && (
          <div style={st.empty}>No parallel paths found.<br/>Add more morphisms to check commutativity.</div>
        )}
        {pairs.map(({ src, tgt, paths }) => {
          const active = isCommuting(src, tgt);
          return (
            <div key={`${src}|${tgt}`} style={{
              padding: '10px 14px', borderBottom: '1px solid #111928',
              background: active ? '#0a1e18' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: active ? '#6ee7b7' : '#c8d3ea', fontFamily: "'Crimson Text', serif",
                  fontStyle: 'italic', fontSize: 15 }}>
                  {nodeLabel(src)} → {nodeLabel(tgt)}
                </span>
                <button onClick={() => onToggle(src, tgt)}
                  style={{
                    padding: '3px 10px', fontSize: 10, fontFamily: 'monospace',
                    background: active ? '#1a4a38' : '#162038',
                    color: active ? '#6ee7b7' : '#4db8ff',
                    border: `1px solid ${active ? '#2a7a60' : '#1e3256'}`,
                    borderRadius: 3, cursor: 'pointer',
                  }}>
                  {active ? '✓ commutes' : 'mark'}
                </button>
              </div>
              {paths.map((p, i) => (
                <div key={i} style={{ color: '#3d5a8a', fontSize: 11, fontFamily: 'monospace',
                  paddingLeft: 8, marginBottom: 2 }}>
                  path {i + 1}: {(p.length === 0 ? ['id'] : p).map((id, j) => (
                    <span key={j}>
                      <span style={{ color: '#5a82c8', fontFamily: "'Crimson Text', serif", fontStyle: 'italic' }}>
                        {p.length === 0 ? 'id' : edgeLabel(id)}
                      </span>
                      {j < p.length - 1 && <span style={{ color: '#2d4070' }}> ∘ </span>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
