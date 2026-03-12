import { useMemo } from 'react';
import { findAllPaths } from './geometry.js';
import { st } from './styles.js';

export default function CommChecker({ nodes, edges, commGroups, onToggleGroup, onClose }) {
  const nodeLabel = id => nodes.find(n => n.id === id)?.label ?? id;

  // For each pair of nodes, find all paths and group them
  const analysis = useMemo(() => {
    const results = [];
    const seen = new Set();
    for (const src of nodes) {
      for (const tgt of nodes) {
        if (src.id === tgt.id) continue;
        const key = `${src.id}→${tgt.id}`;
        if (seen.has(key)) continue;
        const paths = findAllPaths(src.id, tgt.id, edges, nodes);
        if (paths.length >= 2) {
          seen.add(key);
          results.push({ src: src.id, tgt: tgt.id, paths });
        }
      }
    }
    return results;
  }, [nodes, edges]);

  const groupKey = (srcId, tgtId) => `${srcId}|${tgtId}`;

  const edgeLabel = id => {
    const e = edges.find(e => e.id === id);
    return e?.label || '—';
  };

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
        Pairs with multiple paths. Toggle to mark as commutative (highlights edges in teal).
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {analysis.length === 0 && (
          <div style={st.empty}>No parallel paths found.<br/>Add more morphisms to check commutativity.</div>
        )}
        {analysis.map(({ src, tgt, paths }) => {
          const gk = groupKey(src, tgt);
          const active = !!commGroups[gk];
          return (
            <div key={gk} style={{
              padding: '10px 14px', borderBottom: '1px solid #111928',
              background: active ? '#0a1e18' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: active ? '#6ee7b7' : '#c8d3ea', fontFamily: "'Crimson Text', serif",
                  fontStyle: 'italic', fontSize: 15 }}>
                  {nodeLabel(src)} → {nodeLabel(tgt)}
                </span>
                <button onClick={() => onToggleGroup(gk, paths.flatMap(p => p.path))}
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
                  path {i + 1}: {p.labels.map((l, j) => (
                    <span key={j}>
                      <span style={{ color: '#5a82c8', fontFamily: "'Crimson Text', serif", fontStyle: 'italic' }}>
                        {l || '—'}
                      </span>
                      {j < p.labels.length - 1 && <span style={{ color: '#2d4070' }}> ∘ </span>}
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
