// Harbor Lights — tuning, palette and world constants. An original open-world
// crime game set in Solmar Bay, a sun-soaked fictional coastal city.
// Protagonist: Mara Voss, a getaway driver. Every name, place, vehicle and
// character here is invented for this game; nothing comes from any
// commercial game, film or real city.
export const WORLD = { width: 3400, height: 2600 };
export const STEP = 1 / 60;
export const ROAD_W = 96;
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const SAVE_KEY = 'solmarbay.save.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PALETTE = {
  grass: '#5d9b4e', grassDark: '#4c8440', sand: '#e8d29a', water: '#2e7fa8',
  waterDeep: '#1f5f84', road: '#3a3f46', roadLine: '#d8c95a', sidewalk: '#9aa0a8',
  park: '#3f7d3a', player: '#ffcf3f', police: '#2f6fd0',
  text: '#f2f5f7', muted: '#b9c2cc', gold: '#ffd166', red: '#e5534b',
  panel: 'rgba(12,18,26,0.96)', hud: 'rgba(12,18,26,0.95)',
};

export const CAR_TYPES = {
  sedan: { name: 'Comet Sedan', color: '#c94f4f', speed: 340, accel: 260, hp: 100 },
  taxi: { name: 'Bay Taxi', color: '#f2c230', speed: 320, accel: 250, hp: 90 },
  van: { name: 'Harbor Van', color: '#7d8aa0', speed: 270, accel: 200, hp: 140 },
  sports: { name: 'Vortex GT', color: '#d23f8e', speed: 460, accel: 340, hp: 80 },
  truck: { name: 'Dock Truck', color: '#5e8a7d', speed: 250, accel: 180, hp: 180 },
  coupe: { name: 'Sunset Coupe', color: '#3f7fd0', speed: 400, accel: 300, hp: 90 },
  police: { name: 'SBPD Cruiser', color: '#2f6fd0', speed: 430, accel: 320, hp: 160 },
};

export const DISTRICTS = [
  { name: 'Old Docks', x: 0, y: 1800, w: 1100, h: 800 },
  { name: 'Marina Bay', x: 2300, y: 1800, w: 1100, h: 800 },
  { name: 'Downtown', x: 1100, y: 600, w: 1200, h: 1200 },
  { name: 'Palm Heights', x: 0, y: 0, w: 1100, h: 600 },
  { name: 'Sunset Strip', x: 2300, y: 0, w: 1100, h: 600 },
  { name: 'Central Park', x: 1100, y: 0, w: 1200, h: 600 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solmar Bay';
}
