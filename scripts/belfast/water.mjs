#!/usr/bin/env node
/**
 * Builds the mask of Belfast's water (the Lagan, the harbour and the lough) from OpenStreetMap, for the water
 * laid over the day city's tiles (src/scene/belfast/water.ts):
 *
 *   public/belfast/water.png  greyscale, white where there's water, over the area in src/scene/belfast/geo.ts
 *
 * Usage: node scripts/belfast/water.mjs [--refresh]
 * Raw Overpass responses are cached in scripts/belfast/.cache (gitignored); --refresh re-downloads them.
 *
 * Data © OpenStreetMap contributors, ODbL (credited on the site).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
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
const [minX, maxZ] = project({ lat: BBOX.south, lon: BBOX.west });
const [maxX, minZ] = project({ lat: BBOX.north, lon: BBOX.east });

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
const water = await overpass('water', `[out:json][timeout:240];(
    way["natural"="water"](${bbox}); relation["natural"="water"](${bbox});
    way["waterway"="riverbank"](${bbox}); way["natural"="coastline"](${bbox});
);out geom;`);

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

// ---------------------------------------------------------------------------------------------
// Rasterised at 2× and box-filtered down for soft edges

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

// ---------------------------------------------------------------------------------------------
// water.png

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

const rows = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) {
    rows[y * (SIZE + 1)] = 0;
    for (let x = 0; x < SIZE; x++) {
        let sum = 0;
        for (let sy = 0; sy < SUPER; sy++) {
            for (let sx = 0; sx < SUPER; sx++) sum += waterGrid[(y * SUPER + sy) * gridW + x * SUPER + sx];
        }
        rows[y * (SIZE + 1) + 1 + x] = Math.round((sum / (SUPER * SUPER)) * 255);
    }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr.writeUInt8(8, 8); // bit depth
ihdr.writeUInt8(0, 9); // greyscale
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
]);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'water.png'), png);

console.log(`water.png ${(png.length / 1024).toFixed(0)} KB, bounds x ${minX.toFixed(0)}..${maxX.toFixed(0)}, z ${minZ.toFixed(0)}..${maxZ.toFixed(0)} m`);
