import {
    BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, IUniform, Mesh, Quaternion, ShaderMaterial, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windows } from '@/scene/choreography';
import { CLOUD_SHADE_GLSL, CLOUD_SHADOW_GLSL, cloudShadowUniforms, photoUniforms } from './photo-materials';

/**
 * The railway from Lanyon Place station, north over the Lagan Railway Bridge and east along the Bangor line: x,
 * the height of the deck, z, in scene units (10 m). The line is from OpenStreetMap.
 */
const TRACK: [number, number, number][] = [
    [-15, 0.45, 99.9], [-16.2, 0.45, 91.3], [-16.8, 0.47, 88.1], [-17.1, 0.5, 85.5], [-17, 0.55, 82.2],
    [-16.1, 0.62, 77.8], [-13.2, 0.62, 64.6], [-12.5, 0.6, 61.4], [-11.7, 0.6, 59], [-10.6, 0.62, 56.4],
    [-8.9, 0.65, 53.8], [-6.7, 0.7, 51.4], [-4.7, 0.75, 49.7], [-0.5, 0.8, 46.6], [2.2, 0.8, 44.7],
    [7.7, 0.8, 40.9], [10.8, 0.8, 38.7], [17.1, 0.75, 34.5], [20.4, 0.7, 32.7], [23.5, 0.65, 31.4],
    [26, 0.6, 30.7], [37.1, 0.55, 28.2], [43, 0.5, 26.9], [54.1, 0.5, 23.7], [60.8, 0.5, 21.8], [67.4, 0.5, 20.5],
    [74.5, 0.5, 19.7], [86.3, 0.5, 18.9], [98.9, 0.5, 17.6], [109.5, 0.5, 16.1], [120.9, 0.5, 13.6],
    [132.1, 0.5, 10.5], [142.3, 0.5, 7.2], [150, 0.5, 4.3], [159.6, 0.5, 0.2], [171.4, 0.5, -5.3],
    [181.1, 0.5, -10.7], [192.3, 0.5, -18.5], [204.3, 0.5, -28.1], [218, 0.5, -38.9],
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

/** Where the middle of the train waits at Lanyon Place, along the track. */
const AT_THE_STATION = 4;

/**
 * It sets off as the Ocula beat starts, pulling away (along the track, scene units, as the square of how far
 * through the rest of the flight the reader is), and is over the middle of the river as the beat is read.
 */
const DEPARTS = windows.ocula[0];
const PULLS_AWAY = 250;

// A three-car NIR Class 4000 (CAF), in scene units: cars about 23 m long, 2.8 m wide and 3.8 m tall
const CAR_LENGTH = 2.3;
const CAR_GAP = 0.06;
const HALF_WIDTH = 0.14;
/** Between a car's bogies, where it meets the track. */
const BOGIE_SPACING = 1.6;
const CARS = 3;

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
 * A Northern Ireland Railways train leaving Lanyon Place: a hand-built three-car Class 4000 in blue and silver.
 * Moved by the scroll like the camera, so however fast the reader goes it crosses the Lagan in front of them
 * during the Ocula beat, and carries on along the Bangor line. Each car follows the track between its own bogies, so the train
 * bends round the curves. Unlit apart from a little shading from the sun, like the tiles.
 */
export const createTrain = (sun: IUniform<Vector3>) => {
    const material = new ShaderMaterial({
        uniforms: { uSun: sun, ...photoUniforms, ...cloudShadowUniforms },
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
            ${CLOUD_SHADOW_GLSL}
            void main() {
                vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
                float sunlit = cloudShadow(vWorld.xz);
                float light = 0.75 + 0.35 * max(dot(n, uSun), 0.0) * sunlit + 0.1 * n.y;
                vec3 color = vGlow > 0.5 ? vColor * 1.6 : vColor * light * mix(${CLOUD_SHADE_GLSL}, vec3(1.0), sunlit);
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

        /** Every frame while the city is shown, with the journey's progress. */
        update(progress: number) {
            const away = Math.max(0, (progress - DEPARTS) / (windows.belfast[1] - DEPARTS));
            const arc = AT_THE_STATION + away * away * PULLS_AWAY;
            // Only on the line, before its end
            group.visible = arc < TRACK_LENGTH - halfTrain;
            if (group.visible) place(arc);
        },

        dispose() {
            cab.dispose();
            middle.dispose();
            material.dispose();
        },
    };
};
