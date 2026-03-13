const STORAGE_KEY = 'catgame_completed';

export function getCompletedLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markLevelComplete(levelId) {
  const completed = getCompletedLevels();
  completed.add(levelId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
}
