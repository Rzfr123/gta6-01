// Harbor Lights — the city of Solmar Bay. A seeded grid of roads, blocks,
// buildings, parks, a beach strip and a marina. Collision helpers keep the
// player, cars and pedestrians out of buildings and inside the map.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, PALETTE } from './config.js';

const BUILD_COLORS = ['#b98a5e', '#7d8aa0', '#a05e6e', '#5e8a7d', '#8a7db0', '#c2a35e'];

export function generateCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  // Blocks are the cells between neighbouring roads.
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Central Park block stays green; the south strip is beach.
      if (ix >= 3 && ix <= 4 && iy === 0) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 14; t += 1) trees.push({ x: x0 + 20 + random() * (x1 - x0 - 40), y: y0 + 20 + random() * (y1 - y0 - 40) });
        continue;
      }
      if (random() < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 6; t += 1) trees.push({ x: x0 + 20 + random() * (x1 - x0 - 40), y: y0 + 20 + random() * (y1 - y0 - 40) });
        continue;
      }
      const n = 1 + Math.floor(random() * 3);
      for (let b = 0; b < n; b += 1) {
        const bw = 70 + random() * 90;
        const bh = 70 + random() * 90;
        const bx = Math.min(x1 - bw, Math.max(x0, cx + (random() - 0.5) * (x1 - x0 - bw)));
        const by = Math.min(y1 - bh, Math.max(y0, cy + (random() - 0.5) * (y1 - y0 - bh)));
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: BUILD_COLORS[Math.floor(random() * BUILD_COLORS.length)],
          tall: random() < 0.3, windows: 2 + Math.floor(random() * 4),
        });
      }
      if (random() < 0.5) trees.push({ x: x0 + 16, y: y0 + 16 });
    }
  }
  return { buildings, trees, parks };
}

/** True when the point is on a road (within half the road width). */
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadX(x) {
  let best = ROADS_X[0];
  for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(y) {
  let best = ROADS_Y[0];
  for (const ry of ROADS_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

/** Push a circle out of every building it overlaps; returns true on hit. */
export function collideBuildings(city, e, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - nx;
    const dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * radius;
        e.y = ny + (dy / d) * radius;
      } else {
        e.x += radius;
      }
    }
  }
  return hit;
}

export function clampToWorld(e, margin = 20) {
  e.x = Math.max(margin, Math.min(WORLD.width - margin, e.x));
  e.y = Math.max(margin, Math.min(WORLD.height - margin, e.y));
}

/** A point on the beach strip along the south edge (water + sand). */
export function beachY() { return WORLD.height - 60; }
export { PALETTE };
