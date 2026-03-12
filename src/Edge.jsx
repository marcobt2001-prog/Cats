import { useMemo } from 'react';
import katex from 'katex';
import { computeGeom, offsetBezier } from './geometry.js';
import { TYPE_META } from './defs.jsx';

function LatexLabel({ raw, x, y, selected, commutative, locked }) {
  const html = useMemo(() => {
    if (!raw) return '';
    try {
      return katex.renderToString(raw, { throwOnError: false, displayMode: false });
    } catch {
      return raw;
    }
  }, [raw]);

  const fill = locked
    ? '#4a6080'
    : commutative ? '#6ee7b7' : selected ? '#ffb74d' : '#c8d3ea';

  if (!raw) return null;
  return (
    <foreignObject x={x - 40} y={y - 14} width={80} height={28}
      style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div xmlns="http://www.w3.org/1999/xhtml"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', color: fill,
          fontFamily: "'Crimson Text', serif", fontSize: 16,
          textShadow: commutative && !locked ? '0 0 8px rgba(110,231,183,0.6)' : 'none',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </foreignObject>
  );
}

export default function Edge({ edge, src, tgt, selected, commutative, onClick, onCurveAdjust, locked }) {
  const geom = computeGeom(src, tgt, edge.curve ?? 0);
  if (!geom) return null;

  const meta = TYPE_META[edge.type] || TYPE_META.morphism;

  const col = locked
    ? '#1e3a5a'
    : commutative ? '#6ee7b7' : selected ? '#ffb74d' : '#4db8ff';

  const tipSuffix = locked
    ? '-locked'
    : commutative ? '-comm' : selected ? '-sel' : '';
  const tipId = `tip${tipSuffix}`;
  const natId = `tip-nat${tipSuffix}`;
  const hookId = `hook${tipSuffix}`;
  const glowFilter = commutative ? 'url(#glow-comm)' : selected ? 'url(#glow)' : undefined;

  const strokeProps = {
    fill: 'none', stroke: col, strokeWidth: locked ? 1.2 : 1.8,
    strokeDasharray: meta.dash || undefined,
    filter: !locked && (selected || commutative) ? glowFilter : undefined,
  };

  const paths = [];

  if (meta.double && !geom.isLoop) {
    paths.push(
      <path key="a" {...strokeProps} d={offsetBezier(geom, -4.5)} markerEnd={`url(#${natId})`} />,
      <path key="b" {...strokeProps} d={offsetBezier(geom,  4.5)} />
    );
  } else {
    paths.push(
      <path key="main" {...strokeProps} d={geom.d}
        markerEnd={`url(#${tipId})`}
        markerStart={meta.hookStart ? `url(#${hookId})` : undefined}
      />
    );
    if (meta.biHead && !geom.isLoop) {
      paths.push(
        <path key="back" {...strokeProps}
          d={`M ${geom.ex} ${geom.ey} Q ${geom.cpx} ${geom.cpy} ${geom.sx} ${geom.sy}`}
          markerEnd={`url(#${tipId})`} />
      );
    }
    if (meta.doubleHead && !geom.isLoop) {
      const t = 0.82;
      const ix = (1-t)*(1-t)*geom.sx + 2*(1-t)*t*geom.cpx + t*t*geom.ex;
      const iy = (1-t)*(1-t)*geom.sy + 2*(1-t)*t*geom.cpy + t*t*geom.ey;
      const tdx = 2*(1-t)*(geom.cpx-geom.sx)+2*t*(geom.ex-geom.cpx);
      const tdy = 2*(1-t)*(geom.cpy-geom.sy)+2*t*(geom.ey-geom.cpy);
      const angle = Math.atan2(tdy, tdx);
      paths.push(
        <line key="head2"
          x1={ix} y1={iy}
          x2={ix + Math.cos(angle)*10} y2={iy + Math.sin(angle)*10}
          stroke={col} strokeWidth={locked ? 1.2 : 1.8} markerEnd={`url(#${tipId})`} />
      );
    }
  }

  return (
    <g onClick={locked ? undefined : onClick}
      style={{ cursor: locked ? 'default' : 'pointer' }}
      opacity={locked ? 0.7 : 1}>
      {!locked && <path d={geom.d} fill="none" stroke="transparent" strokeWidth={24} />}
      {paths}
      <LatexLabel raw={edge.label} x={geom.lx} y={geom.ly}
        selected={selected} commutative={commutative} locked={locked} />
      {!locked && selected && !geom.isLoop && (
        <circle cx={geom.cpx} cy={geom.cpy} r={6} fill="#ffb74d" opacity={0.55}
          style={{ cursor: 'ns-resize' }}
          onMouseDown={e => { e.stopPropagation(); onCurveAdjust(e); }} />
      )}
    </g>
  );
}
