import { useState } from 'react';

export default function CollapsiblePanel({ side, label, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  const isLeft = side === 'left';
  const borderProp = isLeft ? 'borderRight' : 'borderLeft';

  if (!open) {
    return (
      <aside
        onClick={() => setOpen(true)}
        style={{
          width: 28,
          background: '#0c1220',
          [borderProp]: '1px solid #1a2540',
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
          transform: isLeft ? 'rotate(180deg)' : undefined,
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
          <span style={{ fontSize: 8 }}>{isLeft ? '▶' : '◀'}</span>
          {label}
        </div>
      </aside>
    );
  }

  const collapseArrow = isLeft ? '◀' : '▶';

  return (
    <aside style={{
      width: 240,
      background: '#0c1220',
      [borderProp]: '1px solid #1a2540',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
      transition: 'width 200ms ease',
    }}>
      <div style={{
        padding: '13px 16px 10px',
        fontSize: 10,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: '#3d5a8a',
        borderBottom: '1px solid #1a2540',
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>{label}</span>
        <span
          onClick={() => setOpen(false)}
          style={{ cursor: 'pointer', fontSize: 10, color: '#3d5a8a', userSelect: 'none' }}
          title="Collapse panel"
        >{collapseArrow}</span>
      </div>
      {children}
    </aside>
  );
}
