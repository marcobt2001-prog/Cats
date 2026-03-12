export const TYPE_META = {
  morphism: { label: '→',  dash: '',    double: false, hookStart: false, biHead: false },
  mono:     { label: '↪',  dash: '',    double: false, hookStart: true,  biHead: false },
  epi:      { label: '↠',  dash: '',    double: false, hookStart: false, doubleHead: true },
  iso:      { label: '≅',  dash: '',    double: false, hookStart: false, biHead: true  },
  dashed:   { label: '⇢',  dash: '8 4', double: false, hookStart: false, biHead: false },
  natural:  { label: '⇒',  dash: '',    double: true,  hookStart: false, biHead: false },
  exact:    { label: '↣',  dash: '',    double: false, hookStart: true,  doubleHead: true },
  equiv:    { label: '≃',  dash: '',    double: true,  hookStart: false, biHead: true  },
  dotted:   { label: '⋯',  dash: '2 4', double: false, hookStart: false, biHead: false },
};

export const TYPE_OPTIONS = [
  { v: 'morphism', t: '→   Morphism' },
  { v: 'mono',     t: '↪   Monomorphism' },
  { v: 'epi',      t: '↠   Epimorphism' },
  { v: 'iso',      t: '≅   Isomorphism' },
  { v: 'equiv',    t: '≃   Equivalence' },
  { v: 'dashed',   t: '⇢   Dashed' },
  { v: 'dotted',   t: '⋯   Dotted' },
  { v: 'natural',  t: '⇒   Natural Trans.' },
  { v: 'exact',    t: '↣   Exact' },
];

export function Defs() {
  const mkArrow = (id, fill, size = 9) => (
    <marker key={id} id={id} markerWidth={size} markerHeight={size}
      refX={size - 1.5} refY={size / 2} orient="auto" markerUnits="userSpaceOnUse">
      <path d={`M 0 0 L ${size} ${size/2} L 0 ${size} z`} fill={fill} />
    </marker>
  );
  const mkArrowDouble = (id, fill) => (
    <marker key={id} id={id} markerWidth={16} markerHeight={10}
      refX={14} refY={5} orient="auto" markerUnits="userSpaceOnUse">
      <path d={`M 0 0 L 8 5 L 0 10 z M 5 0 L 13 5 L 5 10 z`} fill={fill} />
    </marker>
  );
  const mkHook = (id, stroke) => (
    <marker key={id} id={id} markerWidth={12} markerHeight={12}
      refX={1} refY={6} orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 1 1 A 5 5 0 0 0 1 11" fill="none" stroke={stroke} strokeWidth={1.8} />
    </marker>
  );
  return (
    <defs>
      {mkArrow('tip',          '#4db8ff')}
      {mkArrow('tip-sel',      '#ffb74d')}
      {mkArrow('tip-tmp',      '#7b92b0')}
      {mkArrow('tip-comm',     '#6ee7b7')}
      {mkArrowDouble('tip-nat',     '#4db8ff')}
      {mkArrowDouble('tip-nat-sel', '#ffb74d')}
      {mkArrowDouble('tip-nat-comm','#6ee7b7')}
      {mkHook('hook',        '#4db8ff')}
      {mkHook('hook-sel',    '#ffb74d')}
      {mkHook('hook-comm',   '#6ee7b7')}
      {mkArrow('tip-locked',       '#1e3a5a')}
      {mkArrowDouble('tip-nat-locked', '#1e3a5a')}
      {mkHook('hook-locked',       '#1e3a5a')}
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-comm">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0f1728" strokeWidth={0.5} />
      </pattern>
    </defs>
  );
}
