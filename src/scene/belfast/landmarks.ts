import {
    BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, Euler, Group,
    MathUtils, Matrix4, Mesh, PlaneGeometry, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Earcut } from 'three/src/extras/Earcut.js';
import { createLandmarkMaterial, createLetteringMaterial } from './materials';

/**
 * Belfast's landmarks, hand-built from simple shapes (OSM only has their footprints). Positions and
 * footprints come from OSM via scripts/belfast/build.mjs, which leaves these out of city.bin.
 * Built in metres, placed in scene units (10 m).
 */

const YELLOW = '#ffcc1a';
const STEEL = '#3a3d46';
const STONE = '#c9bea9';
const COPPER = '#6fb395';
const GLASS = '#7d8aa0';
const RED = '#ff2a10';

const parts: BufferGeometry[] = [];

const matrix = (position: [number, number, number], rotationY = 0, scale = 1) =>
    new Matrix4().compose(
        new Vector3(...position),
        new Quaternion().setFromEuler(new Euler(0, rotationY, 0)),
        new Vector3(scale, scale, scale),
    );

/** Adds a shape in the given finish (see createLandmarkMaterial) to the merged landmark mesh. */
const add = (shape: BufferGeometry, color: string, glow = 0, ...transforms: Matrix4[]) => {
    const geometry = shape.index ? shape.toNonIndexed() : shape;
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    transforms.forEach(transform => geometry.applyMatrix4(transform));
    const count = geometry.attributes.position.count;
    const linear = new Color(color).convertSRGBToLinear();
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) linear.toArray(colors, i * 3);
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('glow', new BufferAttribute(new Float32Array(count).fill(glow), 1));
    parts.push(geometry);
};

const box = (width: number, height: number, depth: number, [x, y, z]: [number, number, number]) =>
    new BoxGeometry(width, height, depth).translate(x, y + height / 2, z);

/** A box whose depth (z) tapers from `bottom` to `top` as it rises. */
const taperedBox = (width: number, height: number, bottom: number, top: number, [x, y, z]: [number, number, number]) => {
    const geometry = new BoxGeometry(width, height, 1);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const t = position.getY(i) / height + 0.5;
        position.setZ(i, position.getZ(i) * MathUtils.lerp(bottom, top, t));
    }
    return geometry.translate(x, y + height / 2, z);
};

/** "H&W" for the girders, as an alpha texture. */
const letteringTexture = () => {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [512, 128];
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.font = '800 112px "Funnel Display", Helvetica, Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('H&W', 256, 70);
    const texture = new CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
};

/**
 * Harland & Wolff's gantry cranes: two tapering legs on rails, a box girder across the top with
 * the trolley on it, and aviation lights at the ends. Local x runs along the girder.
 */
const crane = (span: number, height: number, place: Matrix4, lettering: Group, letteringMaterial: ReturnType<typeof createLetteringMaterial>) => {
    const girderDepth = 10;
    const girderHeight = 13;
    for (const side of [-1, 1]) {
        const x = (side * span) / 2;
        add(taperedBox(8, height - girderHeight - 5, 26, 9, [x, 5, 0]), YELLOW, 0, place);
        add(box(10, 5, 34, [x, 0, 0]), STEEL, 0, place);
        add(box(1.6, 1.6, 1.6, [x + side * 7, height + 0.4, 0]), RED, 3, place);
    }
    add(box(span + 16, girderHeight, girderDepth, [0, height - girderHeight, 0]), YELLOW, 0, place);
    add(box(16, 7, 14, [span * 0.18, height, 0]), YELLOW, 0, place);
    add(box(9, 4, 10, [span * 0.18 - 2, height + 7, 0]), STONE, 0, place);

    // The lettering on both faces of the girder, reading the right way round from either side
    for (const side of [-1, 1]) {
        const plane = new Mesh(new PlaneGeometry(span * 0.62, girderHeight * 0.95), letteringMaterial);
        plane.applyMatrix4(new Matrix4().multiplyMatrices(
            place,
            matrix([0, height - girderHeight / 2, (side * girderDepth) / 2 + 0.2], side > 0 ? 0 : Math.PI),
        ));
        lettering.add(plane);
    }
};

/** Extrudes a footprint (scene units) to `height`, with the top ring scaled by `flare` about its centre. */
const extrude = (footprint: [number, number][], height: number, flare = 1) => {
    const n = footprint.length;
    const [cx, cz] = footprint.reduce(([x, z], [px, pz]) => [x + px / n, z + pz / n], [0, 0]);
    const top = footprint.map(([x, z]): [number, number] => [cx + (x - cx) * flare, cz + (z - cz) * flare]);
    const vertices: number[] = [];
    const push = (...points: [number, number, number][]) => points.forEach(point => vertices.push(...point));

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [b0, b1] = [footprint[i], footprint[j]];
        const [t0, t1] = [top[i], top[j]];
        push([b0[0], 0, b0[1]], [b1[0], 0, b1[1]], [t1[0], height, t1[1]]);
        push([b0[0], 0, b0[1]], [t1[0], height, t1[1]], [t0[0], height, t0[1]]);
    }
    const roof = Earcut.triangulate(top.flat(), undefined, 2);
    for (let t = 0; t < roof.length; t += 3) {
        push(...[roof[t], roof[t + 1], roof[t + 2]].map((k): [number, number, number] => [top[k][0], height, top[k][1]]));
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    return geometry;
};

// Titanic Belfast's four prows, from OSM (scene units). The real facade flares outwards as it rises.
const titanicFootprint: [number, number][] = [
    [30.44, -49.78], [30.14, -46.54], [30.93, -46.26], [30.54, -46.08], [30.83, -45.48], [30.72, -45.52],
    [29, -43.09], [31.42, -42.75], [31.7, -43.3], [31.86, -42.84], [32.14, -42.94], [34.41, -41.41],
    [35.07, -44.3], [34.74, -44.37], [34.93, -44.48], [34.77, -45.07], [35.32, -44.98], [37.1, -47.43],
    [34.59, -47.88], [34.08, -47.24], [33.83, -48.1], [33, -47.57], [33.13, -48.46],
];

/** Belfast City Hall: Portland stone quadrangle, corner towers, and the copper dome over the front. */
const cityHall = (place: Matrix4) => {
    const [halfWidth, halfDepth, wing, height] = [50, 37, 17, 18];
    add(box(halfWidth * 2, height, wing, [0, 0, -halfDepth + wing / 2]), STONE, 0, place);
    add(box(halfWidth * 2, height, wing, [0, 0, halfDepth - wing / 2]), STONE, 0, place);
    for (const side of [-1, 1]) {
        add(box(wing, height, halfDepth * 2 - wing * 2, [side * (halfWidth - wing / 2), 0, 0]), STONE, 0, place);
    }
    // Portico
    add(box(30, 15, 8, [0, 0, -halfDepth - 4]), STONE, 0, place);
    add(box(32, 3, 10, [0, 15, -halfDepth - 4]), STONE, 0, place);

    for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
            const at: [number, number, number] = [x * (halfWidth - 5), 0, z * (halfDepth - 5)];
            add(box(10, 27, 10, at), STONE, 0, place);
            add(new SphereGeometry(4.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(at[0], 27, at[2]), COPPER, 0, place);
        }
    }

    const dome: [number, number] = [0, -halfDepth + wing / 2];
    add(new CylinderGeometry(11, 11, 12, 28).translate(dome[0], height + 6, dome[1]), STONE, 0, place);
    add(new SphereGeometry(11, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.35, 1).translate(dome[0], height + 12, dome[1]), COPPER, 0, place);
    add(new CylinderGeometry(2.4, 2.8, 6, 12).translate(dome[0], height + 12 + 14.8 + 3, dome[1]), STONE, 0, place);
    add(new SphereGeometry(2.2, 10, 6).translate(dome[0], height + 12 + 14.8 + 7, dome[1]), COPPER, 2, place);
};

export const createLandmarks = () => {
    parts.length = 0;
    const group = new Group();
    const lettering = new Group();
    const letteringMaterial = createLetteringMaterial(letteringTexture(), new Color('#1a1408').convertSRGBToLinear());

    // From OSM: centre, girder bearing (both ~40° south of east) and span; heights are the real ones
    const bearing = MathUtils.degToRad(-40.5);
    crane(142, 106, matrix([110, 0, -61.9], bearing, 0.1), lettering, letteringMaterial); // Samson
    crane(140, 96, matrix([64.4, 0, -8.1], bearing, 0.1), lettering, letteringMaterial); // Goliath

    add(extrude(titanicFootprint, 3.8, 1.14), GLASS, 1);
    cityHall(matrix([-96.7, 0, 83.7], MathUtils.degToRad(3.8), 0.1));

    const mesh = new Mesh(mergeGeometries(parts), createLandmarkMaterial());
    parts.length = 0;
    group.add(mesh, lettering);
    return group;
};
