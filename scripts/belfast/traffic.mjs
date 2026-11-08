#!/usr/bin/env node
/**
 * Builds the main roads of Belfast from OpenStreetMap, for the traffic driving over the day city's tiles
 * (src/scene/belfast/traffic.ts):
 *
 *   public/belfast/traffic.bin  the roads, joined end to end into long chains (layout below)
 *
 * Usage: node scripts/belfast/traffic.mjs [--refresh]
 * Raw Overpass responses are cached in scripts/belfast/.cache (gitignored); --refresh re-downloads them.
 *
 * Layout (little-endian; x east, z south, in half metres from the origin in src/scene/belfast/geo.ts):
 *   u32 magic 'BTRF', u32 version, u32 roadCount
 *   per road: u8 flags (1 one-way, 2 motorway or trunk), u8 lanes each way, u16 vertexCount, then vertexCount ×
 *             (i16 x, i16 z): the first vertex absolute, the rest as deltas from the previous one, in the direction
 *             of travel if it's one-way
 *
 * Data © OpenStreetMap contributors, ODbL (credited on the site).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = join(root, 'scripts/belfast/.cache');
const outDir = join(root, 'public/belfast');

// Must match src/scene/belfast/geo.ts
const ORIGIN = { lat: 54.604, lon: -5.915 };
const BBOX = { south: 54.586, west: -5.95, north: 54.62, east: -5.885 };

const metresPerLon = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;
const metresPerLat = 110540;
const project = ({ lat, lon }) => [(lon - ORIGIN.lon) * metresPerLon, -(lat - ORIGIN.lat) * metresPerLat];

// ---------------------------------------------------------------------------------------------
// Fetching

const overpass = async (name, query) => {
    const file = join(cacheDir, `${name}.json`);
    if (existsSync(file) && !process.argv.includes('--refresh')) return JSON.parse(readFileSync(file, 'utf8'));

    let text;
    // The public server is often at capacity, so back off and retry
    for (let attempt = 0, wait = 10; !text; attempt++, wait *= 2) {
        console.log(`Fetching ${name}…`);
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'User-Agent': 'craigneeson.co.uk build script', Accept: 'application/json' },
            body: new URLSearchParams({ data: query }),
        });
        if (response.ok) text = await response.text();
        else if (attempt < 5 && [429, 502, 503, 504].includes(response.status)) {
            console.log(`  Overpass ${response.status}, retrying in ${wait}s`);
            await new Promise(resolve => setTimeout(resolve, wait * 1000));
        } else throw new Error(`Overpass ${response.status}: ${await response.text()}`);
    }
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(file, text);
    return JSON.parse(text);
};

const bbox = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
const roadClasses = 'motorway|trunk|primary|secondary|tertiary|residential|unclassified|pedestrian|service|living_street'
    + '|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
// The same query (and so the same cache) as the old city build
const roads = await overpass('city', `[out:json][timeout:240][bbox:${bbox}];(way["building"]; way["highway"~"^(${roadClasses})$"]; way["leisure"~"^(park|garden|pitch)$"]; way["landuse"~"^(grass|recreation_ground|cemetery)$"];);out geom tags;`);

// ---------------------------------------------------------------------------------------------
// Geometry helpers

/** Douglas–Peucker: drops points within `tolerance` (m) of the line through their neighbours. */
const simplify = (points, tolerance) => {
    if (points.length < 3) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop();
        const [ax, az] = points[first];
        const [bx, bz] = points[last];
        const length = Math.hypot(bx - ax, bz - az) || 1e-9;
        let furthest = -1;
        let max = tolerance;
        for (let i = first + 1; i < last; i++) {
            const distance = Math.abs((bx - ax) * (az - points[i][1]) - (ax - points[i][0]) * (bz - az)) / length;
            if (distance > max) [max, furthest] = [distance, i];
        }
        if (furthest !== -1) {
            keep[furthest] = 1;
            stack.push([first, furthest], [furthest, last]);
        }
    }
    return points.filter((_, i) => keep[i]);
};

const quantise = value => Math.max(-32768, Math.min(32767, Math.round(value * 2)));

const encodePoints = points => {
    const buffer = Buffer.alloc(points.length * 4);
    let [px, pz] = [0, 0];
    points.forEach(([x, z], i) => {
        const [qx, qz] = [quantise(x), quantise(z)];
        buffer.writeInt16LE(i === 0 ? qx : qx - px, i * 4);
        buffer.writeInt16LE(i === 0 ? qz : qz - pz, i * 4 + 2);
        [px, pz] = [qx, qz];
    });
    return buffer;
};

// ---------------------------------------------------------------------------------------------
// The main roads, joined end to end into long chains so cars don't stop at every way's end

// Smaller streets the camera passes close by (Queens Road and Sydenham Road, by the cranes, are service roads in OSM)
const TRAFFIC_STREETS = /^(Queens Road|Sydenham Road|Queen's Quay|Adelaide Street|Donegall Square West|Lanyon Place|Station Street( Flyover)?)$/;
const trafficRoads = [];
for (const element of roads.elements) {
    const { highway, oneway, lanes, junction } = element.tags ?? {};
    const isMain = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(highway ?? '');
    if (!(isMain || TRAFFIC_STREETS.test(element.tags?.name ?? '')) || !element.geometry) continue;
    let points = element.geometry.map(project);
    const isOneway = oneway === 'yes' || oneway === '1' || oneway === '-1' || junction === 'roundabout'
        || (/^motorway/.test(highway) && oneway !== 'no');
    if (oneway === '-1') points = points.reverse();
    const total = Number.parseInt(lanes, 10) || (isOneway ? 1 : 2);
    trafficRoads.push({
        points,
        isOneway,
        lanes: Math.max(1, Math.min(3, isOneway ? total : Math.floor(total / 2))),
        isFast: /^(motorway|trunk)$/.test(highway),
    });
}

const endKey = ([x, z]) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
const isSameKind = (a, b) => a.isOneway === b.isOneway && a.lanes === b.lanes && a.isFast === b.isFast;
// Repeatedly joins a road onto one that starts where it ends (or, for two-way roads, either end to either end)
for (let joined = true; joined;) {
    joined = false;
    const starts = new Map();
    trafficRoads.forEach(road => {
        if (road.points) starts.set(endKey(road.points[0]), [...(starts.get(endKey(road.points[0])) ?? []), road]);
    });
    for (const road of trafficRoads) {
        if (!road.points) continue;
        const end = endKey(road.points[road.points.length - 1]);
        let next = (starts.get(end) ?? []).find(other => other !== road && other.points && isSameKind(road, other));
        if (!next && !road.isOneway) {
            next = trafficRoads.find(other => other !== road && other.points && isSameKind(road, other)
                && endKey(other.points[other.points.length - 1]) === end);
            if (next) next.points.reverse();
        }
        if (!next) continue;
        road.points = road.points.concat(next.points.slice(1));
        next.points = null;
        joined = true;
        break;
    }
}

const chunks = [];
const header = Buffer.alloc(12);
header.write('BTRF', 0, 'ascii');
header.writeUInt32LE(1, 4);
const chains = trafficRoads.filter(road => road.points).map(road => ({ ...road, points: simplify(road.points, 0.5) }));
header.writeUInt32LE(chains.length, 8);
chunks.push(header);
for (const road of chains) {
    const head = Buffer.alloc(4);
    head.writeUInt8((road.isOneway ? 1 : 0) | (road.isFast ? 2 : 0), 0);
    head.writeUInt8(road.lanes, 1);
    head.writeUInt16LE(road.points.length, 2);
    chunks.push(head, encodePoints(road.points));
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'traffic.bin'), Buffer.concat(chunks));
console.log(`${chains.length} traffic roads`);
