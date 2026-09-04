import { describe, it, expect } from 'vitest';
import { serializeCat, deserializeCat, CAT_VERSION } from '../serialize.js';
import { markCommuting, isCommuting } from '../commute.js';
import { setMorphismStyle, addObject, checkInvariants } from '../state.js';
import { hypothesesOf } from '../../math/context.js';
import { MathError } from '../../math/expr.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from '../../math/__tests__/fixtures.js';
import { square } from './fixtures.js';

function rich() {
  let s = markCommuting(square(), 'A', 'D');
  s = setMorphismStyle(s, 'f', 'mono');
  s = setMorphismStyle(s, 'g', 'dashed');
  [s] = addObject(s, { x: 5, y: 6, name: 'E' });
  return s;
}

describe('.cat v0.2', () => {
  it('round-trips state and meta', () => {
    const s = rich();
    const json = serializeCat(s, { title: 'Square' });
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(CAT_VERSION);
    expect(parsed.math.context.declarations.find((d: { id: string }) => d.id === 'f').properties).toEqual(['mono']);
    expect(parsed.layout.edges.f.decoration).toBeUndefined();
    expect(parsed.layout.edges.g.decoration).toBe('dashed');

    const back = deserializeCat(json);
    expect(back.state).toEqual(s);
    expect(back.meta.title).toBe('Square');
    expect(back.warnings).toEqual([]);
  });

  it('fills layout gaps with warnings and drops unknown layout ids', () => {
    const raw = JSON.parse(serializeCat(rich()));
    delete raw.layout.nodes.A;
    delete raw.layout.edges.f;
    raw.layout.nodes.ghost = { x: 1, y: 1 };
    raw.layout.edges.g.decoration = 'sparkly';
    const back = deserializeCat(JSON.stringify(raw));
    expect(back.state.layout.nodes['A']).toEqual({ x: 0, y: 0 });
    expect(back.state.layout.edges['f']).toEqual({ curve: 0 });
    expect(back.state.layout.edges['g']).toEqual({ curve: 0 });
    expect(back.warnings).toHaveLength(4);
    expect(checkInvariants(back.state)).toEqual([]);
  });

  it('rejects unsupported versions, invalid JSON, and invalid documents', () => {
    const raw = JSON.parse(serializeCat(rich()));
    expect(() => deserializeCat(JSON.stringify({ ...raw, version: '9' }))).toThrow(MathError);
    expect(() => deserializeCat('nope')).toThrow(MathError);
    raw.math.context.declarations = raw.math.context.declarations.filter((d: { id: string }) => d.id !== 'B');
    expect(() => deserializeCat(JSON.stringify(raw))).toThrow(MathError);
  });
});

describe('.cat v0.1 migration', () => {
  it('migrates a legacy file with commGroups into an equation', () => {
    const legacy = {
      version: '0.1',
      meta: { title: 'Old' },
      nodes: DEFAULT_NODES,
      edges: DEFAULT_EDGES,
      commGroups: { 'A|C': ['f1', 'f2', 'f3'] },
    };
    const back = deserializeCat(JSON.stringify(legacy));
    expect(back.meta.title).toBe('Old');
    expect(back.warnings).toEqual([]);
    expect(hypothesesOf(back.state.doc.context)).toHaveLength(1);
    expect(isCommuting(back.state, 'A', 'C')).toBe(true);
    expect(checkInvariants(back.state)).toEqual([]);
  });

  it('treats a missing version as legacy', () => {
    const back = deserializeCat(JSON.stringify({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES }));
    expect(back.state.layout.nodes['A']).toEqual({ x: 200, y: 240 });
  });
});
