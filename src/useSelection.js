import { useCallback, useMemo, useState } from 'react';

/**
 * Selection state shared by the canvas, the side panels, and clipboard/alignment
 * tools. `sel` is the single "primary" selection; `multiSel` holds 'n:<id>' and
 * 'e:<id>' keys for shift-click and marquee selection.
 */
export function useSelection() {
  const [sel, setSel] = useState(null);
  const [multiSel, setMultiSel] = useState(() => new Set());

  const selNodeIds = useMemo(() => {
    const s = new Set();
    multiSel.forEach(k => { if (k.startsWith('n:')) s.add(k.slice(2)); });
    if (sel?.type === 'node') s.add(sel.id);
    return s;
  }, [multiSel, sel]);

  const selEdgeIds = useMemo(() => {
    const s = new Set();
    multiSel.forEach(k => { if (k.startsWith('e:')) s.add(k.slice(2)); });
    if (sel?.type === 'edge') s.add(sel.id);
    return s;
  }, [multiSel, sel]);

  const selectOne = useCallback((type, id) => { setSel({ type, id }); setMultiSel(new Set()); }, []);

  const toggle = useCallback((type, id) => {
    const k = (type === 'node' ? 'n:' : 'e:') + id;
    setMultiSel(prev => { const s = new Set(prev); s.has(k) ? s.delete(k) : s.add(k); return s; });
    setSel(null);
  }, []);

  const setMany = useCallback((nodeIds, edgeIds, { merge = false } = {}) => {
    setMultiSel(prev => {
      const s = merge ? new Set(prev) : new Set();
      nodeIds.forEach(id => s.add('n:' + id));
      edgeIds.forEach(id => s.add('e:' + id));
      return s;
    });
    setSel(null);
  }, []);

  const clear = useCallback(() => { setSel(null); setMultiSel(new Set()); }, []);

  return { sel, multiSel, selNodeIds, selEdgeIds, selectOne, toggle, setMany, clear };
}
