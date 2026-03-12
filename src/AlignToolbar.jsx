import { st } from './styles.js';

export default function AlignToolbar({ nodes, selNodeIds, onUpdateNodes }) {
  const selected = nodes.filter(n => selNodeIds.has(n.id));
  if (selected.length < 2) return null;

  const align = (axis, fn) => {
    const val = fn(selected.map(n => n[axis]));
    const patches = {};
    selected.forEach(n => { patches[n.id] = { [axis]: val }; });
    onUpdateNodes(patches);
  };

  const distribute = (axis) => {
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) => a[axis] - b[axis]);
    const min = sorted[0][axis];
    const max = sorted[sorted.length - 1][axis];
    const step = (max - min) / (sorted.length - 1);
    const patches = {};
    sorted.forEach((n, i) => { patches[n.id] = { [axis]: Math.round(min + step * i) }; });
    onUpdateNodes(patches);
  };

  const btnStyle = {
    ...st.btn,
    padding: '4px 8px',
    fontSize: 10,
    lineHeight: 1,
  };

  return (
    <div style={{
      position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 3, padding: '5px 8px',
      background: '#0c1220', border: '1px solid #1a2540',
      borderRadius: 5, zIndex: 90, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <span style={{ color: '#3d5a8a', fontSize: 9, alignSelf: 'center', marginRight: 4,
        letterSpacing: '0.1em', textTransform: 'uppercase' }}>ALIGN</span>
      <button style={btnStyle} onClick={() => align('x', vs => Math.min(...vs))} title="Align left">⫷ L</button>
      <button style={btnStyle} onClick={() => align('x', vs => Math.round(vs.reduce((a,b) => a+b, 0) / vs.length))} title="Align center H">⫿ C</button>
      <button style={btnStyle} onClick={() => align('x', vs => Math.max(...vs))} title="Align right">⫸ R</button>
      <div style={{ width: 1, height: 20, background: '#1a2540', margin: '0 2px' }} />
      <button style={btnStyle} onClick={() => align('y', vs => Math.min(...vs))} title="Align top">⊤ T</button>
      <button style={btnStyle} onClick={() => align('y', vs => Math.round(vs.reduce((a,b) => a+b, 0) / vs.length))} title="Align center V">⊡ M</button>
      <button style={btnStyle} onClick={() => align('y', vs => Math.max(...vs))} title="Align bottom">⊥ B</button>
      <div style={{ width: 1, height: 20, background: '#1a2540', margin: '0 2px' }} />
      <button style={btnStyle} onClick={() => distribute('x')} title="Distribute horizontally">⇔ H</button>
      <button style={btnStyle} onClick={() => distribute('y')} title="Distribute vertically">⇕ V</button>
    </div>
  );
}
