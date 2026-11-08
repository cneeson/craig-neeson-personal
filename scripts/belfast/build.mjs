#!/usr/bin/env node
/**
 * Builds the Belfast flythrough data from OpenStreetMap:
 *
 *   public/belfast/city.bin    building footprints + heights, and road centrelines (see layout below)
 *   public/belfast/ground.png  water (red) and parks (green) mask for the ground shader
 *
 * Usage: node scripts/belfast/build.mjs [--refresh]
 * Raw Overpass responses are cached in scripts/belfast/.cache (gitignored); --refresh re-downloads them.
 *
 * Data © OpenStreetMap contributors, ODbL (credited on the site).
 *
 * city.bin layout (little-endian; coordinates in half-metre units relative to ORIGIN, x east, z south):
 *   u32 magic 'BFST', u32 version, u32 buildingCount, u32 roadCount
 *   per building: u16 vertexCount, u16 height (dm), u8 kind, u8 seed, then vertexCount × (i16 x, i16 z):
 *                 first vertex absolute, the rest as deltas from the previous vertex
 *   per road:     u8 class, u16 vertexCount, then vertices encoded as for buildings
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = join(root, 'scripts/belfast/.cache');
const outDir = join(root, 'public/belfast');

// Must match src/scene/belfast/geo.ts
export const ORIGIN = { lat: 54.604, lon: -5.915 };
const BBOX = { south: 54.586, west: -5.95, north: 54.62, east: -5.885 };

const metresPerLon = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320;
const metresPerLat = 110540;
const project = ({ lat, lon }) => [(lon - ORIGIN.lon) * metresPerLon, -(lat - ORIGIN.lat) * metresPerLat];
const [minX, maxZ] = project({ lat: BBOX.south, lon: BBOX.west });
const [maxX, minZ] = project({ lat: BBOX.north, lon: BBOX.east });

// Replaced by hand-built models in the scene
const EXCLUDED_IDS = new Set([
    399604756, // Titanic Belfast
    539787113, // Belfast City Hall
    995882499, // Samson
    995885639, // Goliath
]);

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

const city = await overpass('city', `[out:json][timeout:240][bbox:${bbox}];(
    way["building"];
    way["highway"~"^(${roadClasses})$"];
    way["leisure"~"^(park|garden|pitch)$"]; way["landuse"~"^(grass|recreation_ground|cemetery)$"];
);out geom tags;`);
// Multipolygons are fetched without a global bbox, which would drop their members' geometry
const buildingRelations = await overpass('building-relations', `[out:json][timeout:120];
    relation["building"](${bbox});out geom;`);
const water = await overpass('water', `[out:json][timeout:240];(
    way["natural"="water"](${bbox}); relation["natural"="water"](${bbox});
    way["waterway"="riverbank"](${bbox}); way["natural"="coastline"](${bbox});
);out geom;`);

// ---------------------------------------------------------------------------------------------
// Geometry helpers

const area = ring => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    return sum / 2;
};

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

/** Joins multipolygon member ways end to end into closed rings. */
const stitchRings = ways => {
    const pending = ways.filter(way => way.length > 1).map(way => [...way]);
    const rings = [];
    const same = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
    while (pending.length) {
        let ring = pending.pop();
        let extended = true;
        while (!same(ring[0], ring[ring.length - 1]) && extended) {
            extended = false;
            for (let i = 0; i < pending.length; i++) {
                const way = pending[i];
                const end = ring[ring.length - 1];
                if (same(end, way[0])) ring = ring.concat(way.slice(1));
                else if (same(end, way[way.length - 1])) ring = ring.concat([...way].reverse().slice(1));
                else continue;
                pending.splice(i, 1);
                extended = true;
                break;
            }
        }
        if (ring.length > 3) rings.push(ring);
    }
    return rings;
};

const centroid = ring => ring.reduce(([x, z], [px, pz]) => [x + px / ring.length, z + pz / ring.length], [0, 0]);

// ---------------------------------------------------------------------------------------------
// Buildings

const random = seed => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

const parseMetres = value => {
    const number = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : undefined;
};

// Kinds drive the window styling in the shader: 0 homes, 1 offices/shops, 2 industrial, 3 other
const kindOf = type => {
    if (/^(house|terrace|residential|semidetached_house|detached|apartments|bungalow|dormitory)$/.test(type)) return 0;
    if (/^(commercial|retail|office|hotel|supermarket|civic|public|university|college|hospital|government)$/.test(type)) return 1;
    if (/^(industrial|warehouse|manufacture|hangar|storage_tank|service|transportation|train_station)$/.test(type)) return 2;
    return 3;
};

const heightOf = (tags, footprintArea, seed) => {
    const height = parseMetres(tags.height);
    if (height) return height;
    const levels = parseMetres(tags['building:levels']);
    if (levels) return levels * 3.1 + (tags['roof:levels'] ? 1.5 : 0.5);

    const type = tags.building;
    const vary = (base, spread) => base + random(seed) * spread;
    if (/^(garage|garages|shed|roof|carport|kiosk|hut)$/.test(type)) return vary(2.6, 0.8);
    if (/^(house|terrace|semidetached_house|detached|residential|bungalow)$/.test(type)) return vary(7, 1.6);
    if (type === 'apartments') return vary(11, 8);
    if (/^(church|cathedral)$/.test(type)) return vary(13, 6);
    if (/^(industrial|warehouse|manufacture|hangar)$/.test(type)) return vary(9, 5);
    if (/^(commercial|retail|office|hotel)$/.test(type)) return vary(12, 10);
    // Untyped: bigger footprints are usually taller (city-centre blocks, sheds aside)
    if (footprintArea < 90) return vary(6, 2);
    if (footprintArea < 400) return vary(8, 4);
    if (footprintArea < 2000) return vary(11, 7);
    return vary(12, 8);
};

const buildings = [];
for (const element of [...city.elements.filter(e => e.type === 'way'), ...buildingRelations.elements]) {
    const tags = element.tags ?? {};
    if (!tags.building || EXCLUDED_IDS.has(element.id)) continue;

    let rings;
    if (element.type === 'way' && element.geometry) rings = [element.geometry.map(project)];
    else if (element.type === 'relation') {
        rings = stitchRings(element.members.filter(m => m.role === 'outer' && m.geometry).map(m => m.geometry.map(project)));
    } else continue;

    for (let ring of rings) {
        if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring = ring.slice(0, -1);
        // Simplified as an open line: a closed one's chord has zero length
        ring = simplify(ring, 0.4);
        if (ring.length < 3) continue;
        const footprintArea = Math.abs(area(ring));
        if (footprintArea < 12) continue;
        // Counter-clockwise in x/z (seen from above) so the worker's walls face outwards
        if (area(ring) < 0) ring.reverse();

        const seed = random(element.id);
        buildings.push({
            ring,
            height: Math.min(150, heightOf(tags, footprintArea, element.id)),
            kind: kindOf(tags.building),
            seed: Math.floor(seed * 255),
        });
    }
}

// ---------------------------------------------------------------------------------------------
// Roads

const roadClassOf = highway => {
    if (/^(motorway|trunk|primary|secondary)(_link)?$/.test(highway)) return 0;
    if (/^(tertiary|tertiary_link|residential|unclassified|living_street|pedestrian)$/.test(highway)) return 1;
    return 2;
};

const roads = [];
for (const element of city.elements) {
    const highway = element.tags?.highway;
    if (!highway || element.type !== 'way' || !element.geometry) continue;
    const points = simplify(element.geometry.map(project), 1);
    if (points.length > 1) roads.push({ points, roadClass: roadClassOf(highway) });
}

// ---------------------------------------------------------------------------------------------
// city.bin

const quantise = value => Math.max(-32768, Math.min(32767, Math.round(value * 2)));

const chunks = [];
const header = Buffer.alloc(16);
header.write('BFST', 0, 'ascii');
header.writeUInt32LE(1, 4);
header.writeUInt32LE(buildings.length, 8);
header.writeUInt32LE(roads.length, 12);
chunks.push(header);

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

for (const building of buildings) {
    const head = Buffer.alloc(6);
    head.writeUInt16LE(building.ring.length, 0);
    head.writeUInt16LE(Math.round(building.height * 10), 2);
    head.writeUInt8(building.kind, 4);
    head.writeUInt8(building.seed, 5);
    chunks.push(head, encodePoints(building.ring));
}
for (const road of roads) {
    const head = Buffer.alloc(3);
    head.writeUInt8(road.roadClass, 0);
    head.writeUInt16LE(road.points.length, 1);
    chunks.push(head, encodePoints(road.points));
}

mkdirSync(outDir, { recursive: true });
const bin = Buffer.concat(chunks);
writeFileSync(join(outDir, 'city.bin'), bin);

// ---------------------------------------------------------------------------------------------
// ground.png: rasterised at 2× and box-filtered down for soft edges

const SIZE = 1024;
const SUPER = 2;
const [gridW, gridH] = [SIZE * SUPER, SIZE * SUPER];
const toGrid = ([x, z]) => [((x - minX) / (maxX - minX)) * gridW, ((z - minZ) / (maxZ - minZ)) * gridH];

/** Even-odd scanline fill of a set of rings (so inner rings punch holes). */
const fillRings = (grid, rings, value) => {
    const edges = [];
    for (const ring of rings) {
        const points = ring.map(toGrid);
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) edges.push([points[j], points[i]]);
    }
    for (let y = 0; y < gridH; y++) {
        const scan = y + 0.5;
        const crossings = [];
        for (const [[ax, ay], [bx, by]] of edges) {
            if ((ay <= scan) !== (by <= scan)) crossings.push(ax + ((scan - ay) / (by - ay)) * (bx - ax));
        }
        crossings.sort((a, b) => a - b);
        for (let k = 0; k + 1 < crossings.length; k += 2) {
            const from = Math.max(0, Math.ceil(crossings[k] - 0.5));
            const to = Math.min(gridW - 1, Math.floor(crossings[k + 1] - 0.5));
            for (let x = from; x <= to; x++) grid[y * gridW + x] = value;
        }
    }
};

const waterGrid = new Uint8Array(gridW * gridH);
const parkGrid = new Uint8Array(gridW * gridH);

for (const element of water.elements) {
    const tags = element.tags ?? {};
    if (tags.natural === 'coastline') continue;
    if (element.type === 'way' && element.geometry) fillRings(waterGrid, [element.geometry.map(project)], 1);
    if (element.type === 'relation') {
        const members = element.members.filter(m => m.geometry);
        fillRings(waterGrid, stitchRings(members.map(m => m.geometry.map(project))), 1);
    }
}

// The sea (Belfast Lough and the harbour) has no polygon: draw the coastline as a wall and flood-fill
// the sea side of it from points known to be in the water
const BARRIER = 2;
for (const element of water.elements) {
    if (element.tags?.natural !== 'coastline' || !element.geometry) continue;
    const points = element.geometry.map(project).map(toGrid);
    for (let i = 1; i < points.length; i++) {
        const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
        for (let s = 0; s <= steps; s++) {
            const x = Math.round(ax + ((bx - ax) * s) / steps);
            const y = Math.round(ay + ((by - ay) * s) / steps);
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                if (x + dx >= 0 && x + dx < gridW && y + dy >= 0 && y + dy < gridH) waterGrid[(y + dy) * gridW + x + dx] = BARRIER;
            }
        }
    }
}
// OSM coastlines run with the water on their right, so seed just to that side of each segment
const seaSeeds = [];
for (const element of water.elements) {
    if (element.tags?.natural !== 'coastline' || !element.geometry) continue;
    const points = element.geometry.map(project).map(toGrid);
    for (let i = 1; i < points.length; i++) {
        const [[ax, ay], [bx, by]] = [points[i - 1], points[i]];
        const length = Math.hypot(bx - ax, by - ay);
        if (length < 8) continue;
        // Right of travel with north up is (-dz, dx) in x/z, and the grid's y runs south like z
        const [nx, ny] = [-(by - ay) / length, (bx - ax) / length];
        seaSeeds.push([Math.floor((ax + bx) / 2 + nx * 4), Math.floor((ay + by) / 2 + ny * 4)]);
    }
}
for (const [sx, sy] of seaSeeds) {
    if (sx < 0 || sy < 0 || sx >= gridW || sy >= gridH) continue;
    const stack = [sy * gridW + sx];
    while (stack.length) {
        const index = stack.pop();
        if (waterGrid[index] !== 0) continue;
        waterGrid[index] = 1;
        const [x, y] = [index % gridW, Math.floor(index / gridW)];
        if (x > 0) stack.push(index - 1);
        if (x < gridW - 1) stack.push(index + 1);
        if (y > 0) stack.push(index - gridW);
        if (y < gridH - 1) stack.push(index + gridW);
    }
}
for (let i = 0; i < waterGrid.length; i++) if (waterGrid[i] === BARRIER) waterGrid[i] = 1;

for (const element of city.elements) {
    const tags = element.tags ?? {};
    if (!(tags.leisure || tags.landuse) || element.type !== 'way' || !element.geometry) continue;
    fillRings(parkGrid, [element.geometry.map(project)], 1);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc32 = buffer => {
    let c = 0xffffffff;
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
};

const rows = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y++) {
    rows[y * (SIZE * 3 + 1)] = 0;
    for (let x = 0; x < SIZE; x++) {
        let [w, p] = [0, 0];
        for (let sy = 0; sy < SUPER; sy++) {
            for (let sx = 0; sx < SUPER; sx++) {
                const index = (y * SUPER + sy) * gridW + x * SUPER + sx;
                w += waterGrid[index];
                p += parkGrid[index];
            }
        }
        const offset = y * (SIZE * 3 + 1) + 1 + x * 3;
        rows[offset] = Math.round((w / (SUPER * SUPER)) * 255);
        rows[offset + 1] = Math.round((p / (SUPER * SUPER)) * 255);
        rows[offset + 2] = 0;
    }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr.writeUInt8(8, 8); // bit depth
ihdr.writeUInt8(2, 9); // RGB
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(join(outDir, 'ground.png'), png);

const vertexCount = buildings.reduce((sum, b) => sum + b.ring.length, 0);
console.log(`${buildings.length} buildings (${vertexCount} vertices), ${roads.length} roads`);
console.log(`city.bin ${(bin.length / 1024).toFixed(0)} KB (gzip ${(deflateSync(bin).length / 1024).toFixed(0)} KB), ground.png ${(png.length / 1024).toFixed(0)} KB`);
console.log(`bounds x ${minX.toFixed(0)}..${maxX.toFixed(0)}, z ${minZ.toFixed(0)}..${maxZ.toFixed(0)} m`);
