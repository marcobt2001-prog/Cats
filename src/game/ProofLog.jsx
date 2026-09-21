export default function ProofLog({ given = [], inventory = [], steps = [] }) {
  const sectionStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #1a2540',
  };

  const sectionLabel = {
    fontSize: 9,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    color: '#3d5a8a',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 8,
  };

  const emptyText = {
    color: '#1e3256',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    fontStyle: 'italic',
    lineHeight: 1.7,
  };

  const itemStyle = {
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.8,
  };

  const statusColor = {
    pending: '#3d5a8a',
    // `satisfied` is CATS' own reasoning; `verified` is reserved for Lean (Phase 4).
    satisfied: '#6ee7b7',
    verified: '#6ee7b7',
    rejected: '#ef4444',
    blocked: '#1e3256',
  };

  const statusIcon = {
    pending: '○',
    satisfied: '✓',
    verified: '✓',
    rejected: '✗',
    blocked: '🔒',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Given section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Given</div>
        {given.length === 0
          ? <div style={emptyText}>No givens yet.</div>
          : given.map((g, i) => (
            <div key={i} style={{ ...itemStyle, color: '#7b92b0' }}>
              <span style={{ color: '#4db8ff', marginRight: 6 }}>·</span>
              {g.label}
              {g.description && (
                <span style={{ color: '#2d4a7a', marginLeft: 6 }}>({g.description})</span>
              )}
            </div>
          ))
        }
      </div>

      {/* Inventory section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Inventory</div>
        {inventory.length === 0
          ? <div style={emptyText}>No cards yet.</div>
          : inventory.map((card, i) => (
            <div key={i} style={{ ...itemStyle, color: '#a78bfa' }}>
              <span style={{ marginRight: 6 }}>▪</span>
              {card}
            </div>
          ))
        }
      </div>

      {/* Steps section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Steps</div>
        {steps.length === 0
          ? <div style={emptyText}>Draw morphisms to add proof steps.</div>
          : steps.map((step, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div style={{
                ...itemStyle,
                color: statusColor[step.status] || statusColor.pending,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}>
                <span style={{ flexShrink: 0, fontSize: 11, marginTop: 2 }}>
                  {statusIcon[step.status] || statusIcon.pending}
                </span>
                <span style={{ flex: 1 }}>{step.description}</span>
                {step.lean && <LeanBadge view={step.lean} />}
              </div>
              {step.lean?.kind === 'failed' && (
                <div style={{
                  color: '#ef4444', fontSize: 10, paddingLeft: 20,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {step.lean.message}
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}

/**
 * Lean's verdict, kept visually distinct from CATS' own tick: `satisfied` is
 * teal and means "CATS believes you"; `verified` is gold and means Lean checked
 * it. Conflating them would undo the point of the distinction.
 */
function LeanBadge({ view }) {
  const styles = {
    verified: { text: '⊢', color: '#f5c542', title: 'verified by Lean' },
    failed: { text: '✗', color: '#ef4444', title: 'Lean rejected this' },
    stale: { text: '⊢', color: '#8a7a3a', title: 'the diagram changed since Lean saw it; run again' },
    believed: { text: '', color: 'transparent', title: '' },
    open: { text: '', color: 'transparent', title: '' },
  };
  const s = styles[view.kind] ?? styles.open;
  if (!s.text) return null;
  return (
    <span title={s.title} style={{
      color: s.color, fontSize: 11, flexShrink: 0,
      opacity: view.kind === 'stale' ? 0.7 : 1,
    }}>
      {s.text}
    </span>
  );
}
