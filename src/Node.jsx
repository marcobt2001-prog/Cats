import { useMemo } from 'react';
import katex from 'katex';
import { R } from './geometry.js';

export default function Node({ node, selected, drawSrc, onMouseDown }) {
  const html = useMemo(() => {
    if (!node.label) return '';
    try {
      return katex.renderToString(node.label, { throwOnError: false });
    } catch {
      return node.label;
    }
  }, [node.label]);

  const isDrawSource = drawSrc === node.id;
  const stroke = selected ? '#ffb74d' : isDrawSource ? '#a3e635' : '#2d4a7a';
  const strokeW = (selected || isDrawSource) ? 2.5 : 1.5;

  return (
    <g onMouseDown={e => onMouseDown(e, node.id)}
      style={{ cursor: 'pointer' }}
      filter={selected ? 'url(#glow)' : undefined}>
      <circle cx={node.x} cy={node.y} r={R}
        fill="#141d30" stroke={stroke} strokeWidth={strokeW} />
      <foreignObject x={node.x - R} y={node.y - R} width={R * 2} height={R * 2}
        style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: R * 2 + 'px', height: R * 2 + 'px',
            color: '#e8eef8', fontFamily: "'Crimson Text', serif",
            fontSize: 18, fontStyle: 'italic',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </foreignObject>
    </g>
  );
}
