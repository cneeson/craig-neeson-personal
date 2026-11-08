/**
 * Decodes city.bin (see scripts/belfast/build.mjs) and builds everything the city needs off the
 * main thread: extruded buildings, street lamps, traffic and, where OffscreenCanvas is available,
 * the road texture.
 */
import { Earcut } from 'three/src/extras/Earcut.js';
import { drawRoads, Roads } from './roads';
import { UNIT } from './geo';

export interface CityRequest {
    url: string;
    roadTextureSize: number;
}

export interface CityData {
    /** Buildings: positions (x, y, z), then per vertex (seed + kind × 256, height). */
    positions: Float32Array;
    info: Float32Array;
    index: Uint32Array;
    /** Street lamps, (x, y, z) each. */
    lamps: Float32Array;
    /** Cars: per car the lane segment (ax, az, bx, bz) and (phase, laps per second, 1 = headlights / 0 = tail lights). */
    carSegments: Float32Array;
    carMotion: Float32Array;
    roads: Roads;
    /** The road texture, when the worker could draw it (otherwise the main thread draws `roads`). */
    roadImage?: ImageBitmap;
}

/** Coordinates are stored in half metres. */
const COORD = 1 / (2 * UNIT);
const LAMP_SPACING = 3.2;
const LAMP_HEIGHT = 0.7;
const CAR_SPACING = 4.5;
const CAR_SPEED = 1.3;
const LANE_OFFSET = 0.18;

const random = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

const decode = (buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x54534642) throw new Error('Not a city.bin file');
    const [buildingCount, roadCount] = [view.getUint32(8, true), view.getUint32(12, true)];
    let offset = 16;

    const readPoints = (count: number) => {
        const points = new Float32Array(count * 2);
        let [x, z] = [0, 0];
        for (let i = 0; i < count; i++, offset += 4) {
            x += view.getInt16(offset, true);
            z += view.getInt16(offset + 2, true);
            points[i * 2] = x * COORD;
            points[i * 2 + 1] = z * COORD;
        }
        return points;
    };

    const buildings = [];
    for (let b = 0; b < buildingCount; b++) {
        const count = view.getUint16(offset, true);
        const height = view.getUint16(offset + 2, true) / (10 * UNIT);
        const [kind, seed] = [view.getUint8(offset + 4), view.getUint8(offset + 5)];
        offset += 6;
        let ring = readPoints(count);
        const last = ring.length - 2;
        if (ring.length > 6 && ring[0] === ring[last] && ring[1] === ring[last + 1]) ring = ring.slice(0, last);
        buildings.push({ ring, height, kind, seed });
    }

    const roadPoints: number[] = [];
    const meta: number[] = [];
    for (let r = 0; r < roadCount; r++) {
        const roadClass = view.getUint8(offset);
        const count = view.getUint16(offset + 1, true);
        offset += 3;
        meta.push(roadClass, roadPoints.length / 2, count);
        readPoints(count).forEach(value => roadPoints.push(value));
    }

    return { buildings, roads: { points: new Float32Array(roadPoints), meta: new Uint32Array(meta) } };
};

/** Walls and a flat roof per building. Vertices are shared: the shader derives flat normals itself. */
const extrude = (buildings: ReturnType<typeof decode>['buildings']) => {
    const vertexCount = buildings.reduce((sum, b) => sum + b.ring.length, 0);
    const positions = new Float32Array(vertexCount * 3);
    const info = new Float32Array(vertexCount * 2);
    const indices: number[] = [];
    let base = 0;

    for (const { ring, height, kind, seed } of buildings) {
        const count = ring.length / 2;
        let area = 0;
        for (let i = 0; i < count; i++) {
            const j = (i + 1) % count;
            area += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1];
        }

        // Bottom ring at [base, base + count), top ring after it
        for (let i = 0; i < count; i++) {
            for (const [v, y] of [[base + i, 0], [base + count + i, height]]) {
                positions.set([ring[i * 2], y, ring[i * 2 + 1]], v * 3);
                info.set([seed + kind * 256, height], v * 2);
            }
        }

        // Wound to face outwards, whichever way round the footprint goes
        for (let i = 0; i < count; i++) {
            const j = (i + 1) % count;
            const [b0, b1, t0, t1] = [base + i, base + j, base + count + i, base + count + j];
            if (area > 0) indices.push(b0, t0, b1, b1, t0, t1);
            else indices.push(b0, b1, t0, b1, t1, t0);
        }

        const roof = Earcut.triangulate(Array.from(ring), undefined, 2);
        for (let t = 0; t < roof.length; t += 3) {
            const [a, b, c] = [roof[t], roof[t + 1], roof[t + 2]];
            const facesUp = (ring[b * 2 + 1] - ring[a * 2 + 1]) * (ring[c * 2] - ring[a * 2])
                - (ring[b * 2] - ring[a * 2]) * (ring[c * 2 + 1] - ring[a * 2 + 1]) > 0;
            const top = base + count;
            if (facesUp) indices.push(top + a, top + b, top + c);
            else indices.push(top + a, top + c, top + b);
        }

        base += count * 2;
    }

    const vertexTotal = base;
    return { positions: positions.subarray(0, vertexTotal * 3), info: info.subarray(0, vertexTotal * 2), index: new Uint32Array(indices) };
};

/** Lamps along the main roads, and cars driving along the major ones. */
const streetLife = ({ points, meta }: Roads) => {
    const lamps: number[] = [];
    const carSegments: number[] = [];
    const carMotion: number[] = [];
    let seed = 1;

    for (let r = 0; r < meta.length; r += 3) {
        const [roadClass, first, count] = [meta[r], meta[r + 1], meta[r + 2]];
        if (roadClass > 1) continue;
        let carry = random(r) * LAMP_SPACING;

        for (let i = 0; i + 1 < count; i++) {
            const [ax, az] = [points[(first + i) * 2], points[(first + i) * 2 + 1]];
            const [bx, bz] = [points[(first + i + 1) * 2], points[(first + i + 1) * 2 + 1]];
            const length = Math.hypot(bx - ax, bz - az);
            if (length < 1e-3) continue;

            for (let d = carry; d < length; d += LAMP_SPACING) {
                const t = d / length;
                lamps.push(ax + (bx - ax) * t, LAMP_HEIGHT, az + (bz - az) * t);
            }
            carry = (carry - length) % LAMP_SPACING;
            if (carry < 0) carry += LAMP_SPACING;

            if (roadClass !== 0) continue;
            // One lane each way, offset to the left of the direction of travel
            const [nx, nz] = [(bz - az) / length * LANE_OFFSET, -(bx - ax) / length * LANE_OFFSET];
            const cars = Math.max(1, Math.round(length / CAR_SPACING));
            for (let c = 0; c < cars; c++) {
                const forwards = c % 2 === 0;
                const speed = CAR_SPEED * (0.75 + random(seed++) * 0.5);
                if (forwards) carSegments.push(ax - nx, az - nz, bx - nx, bz - nz);
                else carSegments.push(bx + nx, bz + nz, ax + nx, az + nz);
                carMotion.push(random(seed++), speed / length, forwards ? 1 : 0);
            }
        }
    }

    return { lamps: new Float32Array(lamps), carSegments: new Float32Array(carSegments), carMotion: new Float32Array(carMotion) };
};

self.onmessage = async (event: MessageEvent<CityRequest>) => {
    const { url, roadTextureSize } = event.data;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`city.bin: ${response.status}`);
    const { buildings, roads } = decode(await response.arrayBuffer());

    let roadImage: ImageBitmap | undefined;
    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(roadTextureSize, roadTextureSize);
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
        if (context) {
            drawRoads(context, roads, roadTextureSize);
            roadImage = canvas.transferToImageBitmap();
        }
    }

    const data: CityData = { ...extrude(buildings), ...streetLife(roads), roads, roadImage };
    const transfer: Transferable[] = [
        data.positions.buffer, data.info.buffer, data.index.buffer, data.lamps.buffer,
        data.carSegments.buffer, data.carMotion.buffer, roads.points.buffer, roads.meta.buffer,
    ];
    if (roadImage) transfer.push(roadImage);
    (self as unknown as Worker).postMessage(data, transfer);
};
