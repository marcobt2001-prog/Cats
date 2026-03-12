import { st } from '../styles.js';

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
    verified: '#6ee7b7',
    rejected: '#ef4444',
  };

  const statusIcon = {
    pending: '○',
    verified: '✓',
    rejected: '✗',
  };

  return (
    <div style={{
      width: 320,
      background: '#0c1220',
      borderLeft: '1px solid #1a2540',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={st.panelHdr}>Proof Log</div>

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
              <div key={i} style={{
                ...itemStyle,
                color: statusColor[step.status] || statusColor.pending,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                marginBottom: 4,
              }}>
                <span style={{ flexShrink: 0, fontSize: 11, marginTop: 2 }}>
                  {statusIcon[step.status] || statusIcon.pending}
                </span>
                <span>{step.description}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
