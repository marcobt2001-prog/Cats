import { st } from './styles.js';

/**
 * Lists every pair of objects joined by two or more paths, shows the morphism
 * expression each path denotes, and lets the user assert that they are equal.
 *
 * Purely presentational: `pairs` comes from `describePairs(state)`, which has
 * already done the mathematics (path expressions, equations, whether the pair
 * commutes and whether it does so by definition).
 */
export default function CommChecker({ pairs, onToggle, onCompose, onClose }) {
  return (
    <div style={{
      position: 'absolute', top: 52, right: 248, width: 340,
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
        {pairs.map(pair => {
          const { src, tgt, srcName, tgtName, paths, hypotheses, commutes, byDefinition } = pair;
          return (
            <div key={`${src}|${tgt}`} style={{
              padding: '10px 14px', borderBottom: '1px solid #111928',
              background: commutes ? '#0a1e18' : 'transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: commutes ? '#6ee7b7' : '#c8d3ea', fontFamily: "'Crimson Text', serif",
                  fontStyle: 'italic', fontSize: 15 }}>
                  {srcName} → {tgtName}
                </span>
                <button onClick={() => !byDefinition && onToggle(src, tgt)}
                  disabled={byDefinition}
                  title={byDefinition ? 'These paths are equal by definition; there is nothing to assert.' : undefined}
                  style={{
                    padding: '3px 10px', fontSize: 10, fontFamily: 'monospace',
                    background: commutes ? '#1a4a38' : '#162038',
                    color: commutes ? '#6ee7b7' : '#4db8ff',
                    border: `1px solid ${commutes ? '#2a7a60' : '#1e3256'}`,
                    borderRadius: 3, cursor: byDefinition ? 'default' : 'pointer',
                    opacity: byDefinition ? 0.75 : 1,
                  }}>
                  {byDefinition ? '✓ by definition' : commutes ? '✓ commutes' : 'mark'}
                </button>
              </div>

              {paths.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6,
                  color: '#3d5a8a', fontSize: 11, fontFamily: 'monospace', paddingLeft: 8, marginBottom: 2 }}>
                  <span>path {i + 1}:</span>
                  <span style={{ color: '#5a82c8', fontFamily: "'Crimson Text', serif", fontStyle: 'italic',
                    fontSize: 13, flex: 1 }}>
                    {p.text}
                  </span>
                  {onCompose && p.ids.length >= 2 && (
                    <button onClick={() => onCompose(src, tgt, p.expr)}
                      title="Add an arrow defined as this composite"
                      style={{ padding: '1px 6px', fontSize: 9, fontFamily: 'monospace',
                        background: '#162038', color: '#4db8ff', border: '1px solid #1e3256',
                        borderRadius: 3, cursor: 'pointer' }}>
                      compose
                    </button>
                  )}
                </div>
              ))}

              {hypotheses.length > 0 && (
                <div style={{ marginTop: 6, paddingLeft: 8 }}>
                  {hypotheses.map(h => (
                    <div key={h.id} style={{ color: '#6ee7b7', fontSize: 11,
                      fontFamily: "'Crimson Text', serif", fontStyle: 'italic', lineHeight: 1.6 }}>
                      {h.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
