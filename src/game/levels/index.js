import { WORLD1_LEVELS } from './world1-sets.js';

// All levels keyed by id
export const LEVELS = {};
[...WORLD1_LEVELS].forEach(lv => { LEVELS[lv.id] = lv; });

// World structure for navigation
export const WORLDS = [
  {
    id: 1,
    name: 'Sets and Functions',
    aluffiRef: 'I §1–2',
    levels: WORLD1_LEVELS.map(lv => lv.id),
  },
  {
    id: 2,
    name: 'Categories',
    aluffiRef: 'III §1–3',
    levels: [],
  },
  {
    id: 3,
    name: 'Morphisms & Functors',
    aluffiRef: 'III §4–6',
    levels: [],
  },
  {
    id: 4,
    name: 'Universal Properties',
    aluffiRef: 'III §6–7',
    levels: [],
  },
  {
    id: 5,
    name: 'Groups',
    aluffiRef: 'II §1–3',
    levels: [],
  },
  {
    id: 6,
    name: 'Free Groups',
    aluffiRef: 'II §5',
    levels: [],
  },
  {
    id: 7,
    name: 'Subgroups',
    aluffiRef: 'II §6–7',
    levels: [],
  },
  {
    id: 8,
    name: 'Quotient Groups',
    aluffiRef: 'II §8–9',
    levels: [],
  },
];
