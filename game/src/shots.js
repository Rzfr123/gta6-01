// Harbor Lights — deterministic screenshot scenes. Each scene stages a
// fixed game state from a seed (no wall clock, no input), so the same seed
// renders the same frame every run: title, driving, wanted chase, mission.
import { spawnTraffic } from './traffic.js';
import { spawnPolice } from './police.js';
import { startMission } from './missions.js';
import { makeCar, addWanted } from './state.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

export function stageShot(G, name) {
  const p = G.player;
  if (name === 'title') {
    p.x = 1400; p.y = 1000; p.inCar = null;
    G.camera.x = p.x - 640; G.camera.y = p.y - 360;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'driving') {
    const car = makeCar(G, 'sports', 1400, 1000, 0, {});
    car.speed = 300;
    p.inCar = car; p.x = car.x; p.y = car.y; p.angle = 0;
    spawnTraffic(G, 6);
    G.camera.x = p.x - 640; G.camera.y = p.y - 360;
    G.cash = 1250;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'wanted') {
    const car = makeCar(G, 'coupe', 1400, 1000, 0, {});
    car.speed = 280;
    p.inCar = car; p.x = car.x; p.y = car.y;
    addWanted(G, 3);
    // Police cruisers close enough to be in frame, already chasing.
    const copSpots = [[1000, 820], [1800, 900], [1400, 1250]];
    for (const [x, y] of copSpots) {
      const cop = spawnPolice(G);
      cop.car.x = x; cop.car.y = y;
      cop.car.angle = Math.atan2(p.y - y, p.x - x);
      cop.car.speed = 380;
    }
    spawnTraffic(G, 5);
    G.camera.x = p.x - 640; G.camera.y = p.y - 360;
    return { screen: SCREEN_PLAY };
  }
  // mission: mid-shootout in Central Park, mission 2.
  G.missionIndex = 2;
  startMission(G);
  G.dialogue = null;
  p.x = 1480; p.y = 560; p.inCar = null; p.hp = 82; p.armor = 40;
  G.mission.spawned = true;
  G.mission.step = 0;
  // Spawn the gangsters directly around the park.
  const spots = [[1500, 340], [1720, 380], [1560, 560], [1740, 520]];
  for (const [x, y] of spots) {
    G.enemies.push({ x, y, angle: 0, hp: 60, shootT: 1, dead: false, color: '#5e2b8a', name: 'Harlow gangster', speed: 90 });
  }
  spawnTraffic(G, 4);
  G.cash = 2100;
  G.camera.x = p.x - 640; G.camera.y = p.y - 360;
  return { screen: SCREEN_PLAY };
}
