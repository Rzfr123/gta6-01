// Harbor Lights — the wanted system and the Solmar Bay Police Department.
// Wanted stars rise with crimes and fall when the player stays out of sight.
// Police cruisers spawn at the map edge, chase, ram and (on foot) arrest;
// a pay-and-spray garage clears the heat for cash.
import { WORLD } from './config.js';
import { makeCar, addWanted, damagePlayer, explodeCar } from './state.js';
import { collideBuildings } from './city.js';
import { burst } from './particles.js';
import { sfx } from './audio.js';

export const SPRAY_COST = 200;

export function wantedMaxCops(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] ?? 0;
}

export function spawnPolice(G) {
  const p = G.player;
  const angle = G.random() * Math.PI * 2;
  const x = Math.max(80, Math.min(WORLD.width - 80, p.x + Math.cos(angle) * 700));
  const y = Math.max(80, Math.min(WORLD.height - 80, p.y + Math.sin(angle) * 700));
  const car = makeCar(G, 'police', x, y, Math.atan2(p.y - y, p.x - x), { traffic: false });
  const cop = { car, shootT: 1 + G.random(), arrestT: 0, ramT: 0 };
  G.cops.push(cop);
  return cop;
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Decay: staying unseen and slow for a while cools the heat.
  if (G.wanted > 0) {
    G.wantedTimer += dt;
    const far = G.cops.every((c) => Math.hypot(c.car.x - p.x, c.car.y - p.y) > 420);
    if (G.wantedTimer > 14 && far) {
      G.wanted -= 1; G.wantedTimer = 0;
      if (G.wanted === 0) showClear(G);
    }
  }
  const want = wantedMaxCops(G.wanted);
  while (G.cops.length < want) spawnPolice(G);
  while (G.cops.length > want) {
    const cop = G.cops.pop();
    if (cop) { cop.car.dead = true; }
  }
  for (let i = G.cops.length - 1; i >= 0; i -= 1) {
    const cop = G.cops[i];
    const car = cop.car;
    if (car.dead) { G.cops.splice(i, 1); continue; }
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const desired = dist > 260 ? car.maxSpeed : car.maxSpeed * 0.75;
    car.speed += Math.max(-300 * dt, Math.min(320 * dt, desired - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Police cars obey buildings: a cruiser that clips a block slows down
    // instead of driving through it (and getting stuck on the far side).
    if (car.police && collideBuildings(G.city, car, 20)) {
      car.speed *= 0.5;
      if (Math.abs(car.speed) > 200) { car.hp -= 5; sfx.crash(); }
    }
    // Ram the player's car; bump the player on foot.
    if (dist < 44) {
      if (p.inCar) {
        // A ram scrape hurts the car (14 hp/s of contact), it does not
        // detonate it: the old 14*dt*10 was 140 hp/s and exploded every
        // stolen car within a second of a police touch.
        p.inCar.hp -= 14 * dt;
        p.inCar.speed *= 0.92;
        car.speed *= 0.6;
        if (G.random() < dt * 4) { burst(G.particles, car.x, car.y, { count: 4, color: '#ffb347', speed: 120, life: 0.3, size: 2 }); sfx.crash(); }
        if (p.inCar.hp <= 0) explodeCar(G, p.inCar);
      } else {
        cop.arrestT += dt;
        if (cop.arrestT > 1.4) {
          bustPlayer(G);
          return;
        }
      }
    } else {
      cop.arrestT = Math.max(0, cop.arrestT - dt);
    }
    // Cops shoot at the player when close and the heat is high.
    cop.shootT -= dt;
    if (G.wanted >= 2 && dist < 420 && cop.shootT <= 0) {
      cop.shootT = 1.2 + G.random() * 0.8;
      const a = Math.atan2(p.y - car.y, p.x - car.x) + (G.random() - 0.5) * 0.3;
      G.bullets.push({
        x: car.x, y: car.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
        life: 0.8, friendly: false, damage: 7,
      });
      sfx.enemyShoot();
    }
    if (car.hp <= 0) { explodeCar(G, car); G.cops.splice(i, 1); }
  }
  // Remove wrecked police cars from the car list over time.
  G.cars = G.cars.filter((c) => !c.dead || Math.hypot(c.x - p.x, c.y - p.y) < 1000);
}

function showClear(G) {
  G.toast = 'You lost the police. Heat is off — for now.';
  G.toastTimer = 3;
}

export function bustPlayer(G) {
  const p = G.player;
  G.stats.busted += 1;
  const fine = Math.min(G.cash, 150 + G.wanted * 50);
  G.cash -= fine;
  G.wanted = 0;
  G.wantedTimer = 0;
  G.cops = [];
  if (p.inCar) { p.inCar = null; }
  // Busted: wake up outside the SBPD station in Downtown, fined.
  p.x = 1400; p.y = 1400; p.hp = 100; p.armor = 0; p.arrest = 0;
  G.toast = `BUSTED! The SBPD fined you $${fine} and dropped you at the station.`;
  G.toastTimer = 4;
  sfx.busted();
}

export function payAndSpray(G) {
  if (G.cash < SPRAY_COST) return false;
  if (G.wanted === 0) return false;
  G.cash -= SPRAY_COST;
  G.wanted = 0;
  G.wantedTimer = 0;
  G.cops = [];
  G.toast = 'Fresh paint, new plates. The heat is gone.';
  G.toastTimer = 3;
  return true;
}
