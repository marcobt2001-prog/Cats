import { useMemo } from 'react';
import katex from 'katex';
import { R } from './geometry.js';

export default function Node({ node, selected, drawSrc, onMouseDown, locked }) {
  const html = useMemo(() => {
    if (!node.label) return '';
    try {
      return katex.renderToString(node.label, { throwOnError: false });
    } catch {
      return node.label;
    }
  }, [node.label]);

  const isDrawSource = drawSrc === node.id;

  const stroke = locked
    ? '#2d4a7a'
    : selected ? '#ffb74d' : isDrawSource ? '#a3e635' : '#2d4a7a';
  const strokeW = locked
    ? 1.2
    : (selected || isDrawSource) ? 2.5 : 1.5;
  const fillColor = locked ? '#101828' : '#141d30';

  // Always report the gesture; the canvas decides what a locked node may do
  // (it can be a morphism endpoint but not be moved, selected, or deleted).
  return (
    <g onMouseDown={e => onMouseDown(e, node.id)}
      style={{ cursor: locked ? 'default' : 'pointer' }}
      filter={!locked && selected ? 'url(#glow)' : undefined}
      opacity={locked ? 0.7 : 1}>
      <circle cx={node.x} cy={node.y} r={R}
        fill={fillColor} stroke={stroke} strokeWidth={strokeW} />
      <foreignObject x={node.x - R} y={node.y - R} width={R * 2} height={R * 2}
        style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <div xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: R * 2 + 'px', height: R * 2 + 'px',
            color: locked ? '#6b7fa0' : '#e8eef8',
            fontFamily: "'Crimson Text', serif",
            fontSize: 18, fontStyle: 'italic',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </foreignObject>
    </g>
  );
}
