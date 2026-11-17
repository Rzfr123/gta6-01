// Harbor Lights — save/load. localStorage only; a missing or hostile
// storage never breaks the game. Saves cash, story progress, stats and
// the player's position, health and time of day.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return s;
  } catch { return null; }
}

export function saveGame(G) {
  try {
    const s = {
      cash: G.cash, mission: G.missionIndex, completed: G.completedMissions,
      kills: G.stats.kills, stolen: G.stats.stolen, earned: G.stats.earned,
      x: G.player.x, y: G.player.y, hp: G.player.hp, armor: G.player.armor,
      time: G.timeOfDay, best: G.best, storyDone: G.storyDone,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
