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
