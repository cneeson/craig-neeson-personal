/**
 * Belfast's place in the scene. Must match scripts/belfast/build.mjs, which writes city.bin and
 * ground.png in metres relative to ORIGIN (x east, z south). The scene works in units of 10 m.
 */
export const ORIGIN = { lat: 54.604, lon: -5.915 };
const BBOX = { south: 54.586, west: -5.95, north: 54.62, east: -5.885 };

/** Metres per scene unit. */
export const UNIT = 10;

const metresPerLon = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;
const metresPerLat = 110540;

/** The area covered by the data (and by ground.png, whose first row is the north edge), in scene units. */
export const bounds = {
    minX: ((BBOX.west - ORIGIN.lon) * metresPerLon) / UNIT,
    maxX: ((BBOX.east - ORIGIN.lon) * metresPerLon) / UNIT,
    minZ: (-(BBOX.north - ORIGIN.lat) * metresPerLat) / UNIT,
    maxZ: (-(BBOX.south - ORIGIN.lat) * metresPerLat) / UNIT,
};

export type Point = [number, number, number];

/** Landmarks the flight passes, labelled on screen while `[from, to]` of the flight (0 → 1). */
export const landmarks: { name: string; position: Point; from: number; to: number }[] = [
    { name: 'Samson & Goliath', position: [87, 11.5, -35], from: 0.12, to: 0.42 },
    { name: 'Titanic Belfast', position: [33, 4.6, -45.5], from: 0.4, to: 0.6 },
    { name: 'The Big Fish', position: [-43, 1, 28], from: 0.62, to: 0.75 },
    { name: 'Albert Clock', position: [-60.4, 3.8, 34.7], from: 0.64, to: 0.8 },
    { name: 'City Hall', position: [-96.9, 5.8, 81.2], from: 0.78, to: 0.98 },
];
