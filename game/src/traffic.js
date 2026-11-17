// Harbor Lights — traffic and pedestrian AI. Traffic cars cruise along the
// road grid, slow for the car ahead, turn at intersections and panic-flee
// from gunfire. Pedestrians stroll the sidewalks and run from danger.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, CAR_TYPES } from './config.js';
import { nearestRoadX, nearestRoadY, collideBuildings, clampToWorld, onRoad } from './city.js';
import { makeCar } from './state.js';

const TRAFFIC_TYPES = ['sedan', 'taxi', 'van', 'coupe', 'truck'];

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i += 1) {
    const horizontal = G.random() < 0.5;
    const type = TRAFFIC_TYPES[Math.floor(G.random() * TRAFFIC_TYPES.length)];
    const t = CAR_TYPES[type];
    let x; let y; let angle;
    if (horizontal) {
      y = ROADS_Y[Math.floor(G.random() * ROADS_Y.length)] + (G.random() < 0.5 ? -22 : 22);
      x = 100 + G.random() * (WORLD.width - 200);
      angle = y % 2 === 0 ? 0 : Math.PI;
      angle = G.random() < 0.5 ? 0 : Math.PI;
    } else {
      x = ROADS_X[Math.floor(G.random() * ROADS_X.length)] + (G.random() < 0.5 ? -22 : 22);
      y = 100 + G.random() * (WORLD.height - 200);
      angle = G.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    const car = makeCar(G, type, x, y, angle, {
      traffic: true, axis: horizontal ? 'h' : 'v',
      dir: 1, targetSpeed: 90 + G.random() * 70,
    });
    car.speed = car.targetSpeed;
  }
}

function carAhead(G, car, dist) {
  let best = null;
  let bestD = dist;
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < bestD && side < 26) { best = o; bestD = forward; }
  }
  return best;
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (!car.traffic || car.dead) continue;
    // Panic: flee from the player when shots are fired nearby.
    const dPlayer = Math.hypot(car.x - p.x, car.y - p.y);
    const fleeing = G.bullets.length > 0 && dPlayer < 320;
    const target = fleeing ? car.maxSpeed * 1.3 : car.targetSpeed;
    const ahead = carAhead(G, car, 90);
    const want = ahead ? 0 : target;
    car.speed += Math.max(-260 * dt, Math.min(180 * dt, want - car.speed));
    // At an intersection, sometimes turn onto the crossing road.
    const onX = Math.abs(car.x - nearestRoadX(car.x)) < 6;
    const onY = Math.abs(car.y - nearestRoadY(car.y)) < 6;
    if (onX && onY && G.random() < dt * 0.25) {
      const turn = G.random() < 0.5;
      if (turn) {
        car.angle += (G.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        car.axis = car.axis === 'h' ? 'v' : 'h';
      }
    }
    // Steer back onto the lane centre of the current road.
    const lane = car.axis === 'h' ? nearestRoadY(car.y) : nearestRoadX(car.x);
    const off = car.axis === 'h' ? car.y - lane : car.x - lane;
    if (Math.abs(off) > 8) {
      const corr = (car.axis === 'h' ? -Math.sign(off) * 0.35 : Math.sign(off) * 0.35);
      car.angle += (car.axis === 'h' ? corr : -corr) * dt * 2;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the map edges so traffic never runs out.
    if (car.x < 40) car.x = WORLD.width - 40;
    if (car.x > WORLD.width - 40) car.x = 40;
    if (car.y < 40) car.y = WORLD.height - 40;
    if (car.y > WORLD.height - 40) car.y = 40;
    if (car.hp < car.maxHp * 0.3 && G.random() < dt * 0.5) {
      car.smokeT = 0.2;
    }
  }
  // Keep traffic topped up near the player, but capped: without the cap
  // the top-up spawns two cars a step and the car list grows forever.
  const near = G.cars.filter((c) => c.traffic && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 900).length;
  const totalTraffic = G.cars.filter((c) => c.traffic && !c.dead).length;
  G.trafficTimer = (G.trafficTimer ?? 0) - dt;
  if (near < 8 && totalTraffic < 24 && G.trafficTimer <= 0) {
    G.trafficTimer = 2;
    spawnTraffic(G, 2);
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ped.walkT -= dt;
    const dPlayer = Math.hypot(ped.x - p.x, ped.y - p.y);
    const danger = (G.bullets.length > 0 && dPlayer < 300) || (p.inCar && dPlayer < 90 && Math.abs(p.inCar.speed) > 120);
    if (danger) ped.panic = 1.5;
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
    } else {
      if (ped.walkT <= 0) {
        ped.walkT = 2 + G.random() * 3;
        // Stroll along a road: snap to the nearest road and walk it.
        if (onRoad(ped.x, ped.y)) {
          const hx = Math.abs(ped.x - nearestRoadX(ped.x)) < Math.abs(ped.y - nearestRoadY(ped.y));
          ped.angle = hx ? (G.random() < 0.5 ? 0 : Math.PI) : (G.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        } else {
          ped.angle = Math.atan2(nearestRoadY(ped.y) - ped.y, nearestRoadX(ped.x) - ped.x);
        }
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    collideBuildings(G.city, ped, 10);
    clampToWorld(ped);
    // A speeding player car hitting a pedestrian is a crime.
    if (p.inCar && Math.abs(p.inCar.speed) > 150 && Math.hypot(ped.x - p.x, ped.y - p.y) < 26) {
      ped.dead = true;
      p.inCar.speed *= 0.7;
      G.wanted = Math.min(5, G.wanted + 1);
    }
  }
  G.peds = G.peds.filter((ped) => !ped.dead || Math.hypot(ped.x - p.x, ped.y - p.y) < 1200);
  if (G.peds.length < 14) {
    const rx = ROADS_X[Math.floor(G.random() * ROADS_X.length)];
    const ry = ROADS_Y[Math.floor(G.random() * ROADS_Y.length)];
    G.peds.push({
      x: p.x + (G.random() - 0.5) * 700, y: p.y + (G.random() - 0.5) * 700,
      angle: G.random() * Math.PI * 2, speed: 45 + G.random() * 25,
      color: '#e8b48a', name: 'Pedestrian', hp: 30, panic: 0, walkT: 0, dead: false,
    });
    void rx; void ry;
  }
}
