import { WORLD1_LEVELS } from './world1-sets.js';

// All levels keyed by id
export const LEVELS = {};
[...WORLD1_LEVELS].forEach(lv => { LEVELS[lv.id] = lv; });

// World structure for navigation
export const WORLDS = [
  {
    id: 1,
    name: 'Sets and Functions',
    aluffiRef: 'I \u00A71\u20132',
    levels: WORLD1_LEVELS.map(lv => lv.id),
  },
];
