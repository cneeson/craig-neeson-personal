import {
    BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, IUniform, Mesh, Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flightAt } from './flight';
import { photoUniforms } from './photo-materials';

/**
 * The railway over the Dargan Bridge, from Lanyon Place north over the Lagan and on towards Yorkgate: x, the
 * height of the deck (measured from the tiles), z, in scene units (10 m). The line is from OpenStreetMap.
 */
const TRACK: [number, number, number][] = [
    [-13.59, 0.53, 64.5], [-10.76, 0.73, 50.2], [-10.11, 0.81, 44.45], [-10.27, 0.85, 41.64], [-11.13, 0.92, 37.39],
    [-12.23, 0.96, 34.36], [-13.63, 0.98, 31.76], [-15.49, 1, 29.14], [-17.15, 1.01, 27.29], [-20.15, 1.02, 24.59],
    [-45.61, 1, 9.35], [-49.5, 0.94, 6.03], [-53.91, 0.92, 0.75], [-57.22, 0.95, -4.18], [-59.71, 1.01, -9.43],
    [-62.53, 1.03, -18.64], [-62.84, 1.04, -23.72], [-62.73, 0.94, -36.22], [-61.79, 0.81, -41.88],
    [-60.3, 0.75, -46.21], [-58.68, 0.64, -49.36], [-55.88, 0.6, -53.92], [-49.25, 0.74, -63.42],
    [-46.33, 0.73, -69.66], [-44.1, 0.67, -78.04], [-43.66, 0.53, -81.29], [-43.61, 0.21, -88.85],
];

/** The heights are the top of the bridge's parapets, which hide the wheels. */
const RAIL_BELOW_PARAPET = 0.08;

const points = TRACK.map(([x, y, z]) => new Vector3(x, y - RAIL_BELOW_PARAPET, z));
const lengths = points.map((point, i) => (i === 0 ? 0 : point.distanceTo(points[i - 1])));
let run = 0;
const arcs = lengths.map(length => (run += length));
const TRACK_LENGTH = run;

/** The point `arc` units along the track. */
const trackAt = (arc: number, target: Vector3) => {
    let i = 1;
    while (i < arcs.length - 1 && arcs[i] < arc) i++;
    const t = (arc - arcs[i - 1]) / (arcs[i] - arcs[i - 1]);
    return target.lerpVectors(points[i - 1], points[i], Math.min(1, Math.max(0, t)));
};

/** How far along the track the middle of the river is: where the train should be when the reader sees it. */
const OVER_THE_RIVER = 58;

// A three-car NIR Class 4000 (CAF), in scene units: cars about 23 m long, 2.8 m wide and 3.8 m tall
const CAR_LENGTH = 2.3;
const CAR_GAP = 0.06;
const HALF_WIDTH = 0.14;
/** Between a car's bogies, where it meets the track. */
const BOGIE_SPACING = 1.6;
const CARS = 3;

/**
 * How far along the flight (0..1) the reader passes over the river crossing. Facing back the way they came,
 * they see the bridge from then on.
 */
const PASSES_THE_BRIDGE = (() => {
    const [river, camera, target] = [trackAt(OVER_THE_RIVER, new Vector3()), new Vector3(), new Vector3()];
    let [nearest, closest] = [0, Infinity];
    for (let t = 0; t <= 1; t += 0.001) {
        flightAt(t, camera, target);
        const distance = Math.hypot(camera.x - river.x, camera.z - river.z);
        if (distance < closest) [nearest, closest] = [t, distance];
    }
    return nearest;
})();

/** How long after passing the bridge the train is over the middle of the river, in the middle of the view. */
const SEEN_AFTER = 0.02;

/** Track (scene units) covered per unit of flight: it crosses the river in about a sixth of the flight. */
const TRACK_PER_FLIGHT = 180;

const SILVER = '#d4d8de';
const BLUE = '#1d4f9c';
const GLASS = '#2b3644';
const ROOF = '#7f848b';
const UNDERFRAME = '#26282c';
const YELLOW = '#f2c418';
const DOOR = '#2e5ea8';
const LAMP = '#fff6e0';

const colored = (geometry: BufferGeometry, color: string, glow = 0) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    part.deleteAttribute('normal');
    part.deleteAttribute('uv');
    const linear = new Color(color).convertSRGBToLinear();
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) linear.toArray(colors, i * 3);
    part.setAttribute('color', new BufferAttribute(colors, 3));
    part.setAttribute('glow', new BufferAttribute(new Float32Array(count).fill(glow), 1));
    return part;
};

/** A box from x0 to x1 along the car, y0 to y1 above the rails, `halfWidth` either side. */
const box = (x0: number, x1: number, y0: number, y1: number, halfWidth: number) =>
    new BoxGeometry(x1 - x0, y1 - y0, halfWidth * 2).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);

/** Slopes the front (+x end) of a box back as it rises above `from`, for the cab's raked nose. */
const rake = (geometry: BufferGeometry, front: number, from: number) => {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        if (position.getX(i) > front - 1e-4 && position.getY(i) > from) position.setX(i, front - (position.getY(i) - from) * 0.55);
    }
    return geometry;
};

/** One car, along +x and centred on it. A cab car has its cab at the +x end. */
const createCar = (hasCab: boolean) => {
    const [back, front] = [-CAR_LENGTH / 2, CAR_LENGTH / 2];
    const nose = hasCab ? 0.24 : 0;
    const parts: BufferGeometry[] = [];
    const layer = (y0: number, y1: number, color: string, halfWidth = HALF_WIDTH) => {
        const geometry = box(back, front, y0, y1, halfWidth);
        parts.push(colored(hasCab ? rake(geometry, front, 0.22) : geometry, color));
    };
    layer(0.03, 0.1, UNDERFRAME, HALF_WIDTH - 0.02);
    layer(0.1, 0.13, BLUE);
    layer(0.13, 0.21, SILVER);
    layer(0.21, 0.29, GLASS);
    layer(0.29, 0.35, SILVER);
    layer(0.35, 0.38, ROOF, HALF_WIDTH - 0.025);

    // Two pairs of doors each side, breaking the window band
    const proud = HALF_WIDTH + 0.004;
    for (const x of [-CAR_LENGTH * 0.27, CAR_LENGTH * 0.27]) {
        if (hasCab && x > 0) continue;
        parts.push(colored(box(x - 0.065, x + 0.065, 0.12, 0.33, proud), DOOR));
    }
    if (hasCab) {
        parts.push(colored(box(front - nose - 0.4, front - nose - 0.27, 0.12, 0.33, proud), DOOR));
        // Yellow warning panel and windscreen on the nose, just proud of the body
        parts.push(colored(box(front - 0.02, front + 0.004, 0.08, 0.22, HALF_WIDTH + 0.002), YELLOW));
        parts.push(colored(rake(box(front - 0.15, front + 0.004, 0.22, 0.34, HALF_WIDTH - 0.015), front + 0.004, 0.22), GLASS));
        for (const z of [-0.09, 0.09]) parts.push(colored(box(front, front + 0.008, 0.12, 0.15, 0.025).translate(0, 0, z), LAMP, 1));
    }
    return mergeGeometries(parts);
};

/**
 * A Northern Ireland Railways train over the Dargan Bridge: a hand-built three-car Class 4000 in blue and silver.
 * Moved by the scroll like the camera, so however fast the reader goes it crosses the Lagan in front of them
 * just after they pass over the bridge, and carries on along the line. Each car follows the track between its own bogies, so the train
 * bends round the curves. Unlit apart from a little shading from the sun, like the tiles.
 */
export const createTrain = (sun: IUniform<Vector3>) => {
    const material = new ShaderMaterial({
        uniforms: { uSun: sun, ...photoUniforms },
        vertexShader: /* glsl */ `
            attribute vec3 color;
            attribute float glow;
            varying vec3 vColor;
            varying float vGlow;
            varying vec3 vWorld;
            void main() {
                vColor = color;
                vGlow = glow;
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uSun;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            varying vec3 vColor;
            varying float vGlow;
            varying vec3 vWorld;
            void main() {
                vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
                float light = 0.75 + 0.35 * max(dot(n, uSun), 0.0) + 0.1 * n.y;
                vec3 color = vGlow > 0.5 ? vColor * 1.6 : vColor * light;
                float distance = length(cameraPosition - vWorld);
                float haze = 1.0 - exp(-pow(distance * uFogDensity, 2.0));
                gl_FragColor = vec4(mix(color, uFogColor, haze), 1.0);
            }
        `,
    });

    const cab = createCar(true);
    const middle = createCar(false);
    const group = new Group();
    group.visible = false;
    // Cab cars at either end, facing outwards
    const cars = [new Mesh(cab, material), new Mesh(middle, material), new Mesh(cab, material)];
    cars[2].userData.isReversed = true;
    group.add(...cars);

    const [front, rear, direction] = [new Vector3(), new Vector3(), new Vector3()];
    const along = new Vector3(1, 0, 0);
    const turn = new Quaternion();
    const halfTrain = (CARS * CAR_LENGTH + (CARS - 1) * CAR_GAP) / 2;

    /** Puts the train with its middle `arc` along the track. */
    const place = (arc: number) => {
        cars.forEach((car, i) => {
            // Car 0 leads, heading up the track
            const centre = arc + halfTrain - CAR_LENGTH / 2 - i * (CAR_LENGTH + CAR_GAP);
            trackAt(centre + BOGIE_SPACING / 2, front);
            trackAt(centre - BOGIE_SPACING / 2, rear);
            car.position.addVectors(front, rear).multiplyScalar(0.5);
            direction.subVectors(front, rear).normalize();
            if (car.userData.isReversed) direction.negate();
            car.quaternion.copy(turn.setFromUnitVectors(along, direction));
        });
    };

    return {
        object: group,

        /** Every frame while the city is shown, with how far along the flight the reader is (0..1). */
        update(flight: number) {
            const arc = OVER_THE_RIVER + (flight - PASSES_THE_BRIDGE - SEEN_AFTER) * TRACK_PER_FLIGHT;
            // Only on the line, between its ends
            group.visible = arc > halfTrain && arc < TRACK_LENGTH - halfTrain;
            if (group.visible) place(arc);
        },

        dispose() {
            cab.dispose();
            middle.dispose();
            material.dispose();
        },
    };
};
