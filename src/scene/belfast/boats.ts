import {
    BoxGeometry, BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, DoubleSide, ExtrudeGeometry, Group, IUniform,
    MathUtils, Mesh, Shape, ShaderMaterial, Vector2, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windows } from '@/scene/choreography';
import { CLOUD_SHADE_GLSL, CLOUD_SHADOW_GLSL, cloudShadowUniforms, photoUniforms } from './photo-materials';

const colored = (geometry: BufferGeometry, color: string) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    part.deleteAttribute('normal');
    part.deleteAttribute('uv');
    const linear = new Color(color).convertSRGBToLinear();
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) linear.toArray(colors, i * 3);
    part.setAttribute('color', new BufferAttribute(colors, 3));
    return part;
};

/** A box from x0 to x1 along the boat, y0 to y1 above the water, `halfWidth` either side. */
const box = (x0: number, x1: number, y0: number, y1: number, halfWidth: number) =>
    new BoxGeometry(x1 - x0, y1 - y0, halfWidth * 2).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);

/**
 * The hull seen from above (x along the boat, its bow at +x; z across), extruded from y0 to y1, with the stem
 * raked forwards by `rake` per unit of height above `deck`, from `bowStart` on.
 */
const hull = (plan: number[][], y0: number, y1: number, { deck, bowStart, rake }: { deck: number, bowStart: number, rake: number }) => {
    const bow = Math.max(...plan.map(([x]) => x));
    const shape = new Shape(plan.map(([x, z]) => new Vector2(x, z)));
    // Extruded along z, then stood up so that's y
    const geometry = new ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false })
        .rotateX(-Math.PI / 2).translate(0, y0, 0);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        if (x > bowStart) position.setX(i, x + (position.getY(i) - deck) * rake * ((x - bowStart) / (bow - bowStart)));
    }
    return geometry;
};

/** How much of the haze the boats take on: less than the tiles, so they stand out a little from the distance. */
const CLARITY = 0.6;

const createBoatMaterial = (sun: IUniform<Vector3>) => new ShaderMaterial({
    uniforms: { uSun: sun, uClarity: { value: CLARITY }, ...photoUniforms, ...cloudShadowUniforms },
    vertexShader: /* glsl */ `
        attribute vec3 color;
        varying vec3 vColor;
        varying vec3 vWorld;
        void main() {
            vColor = color;
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
        }
    `,
    fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        uniform float uClarity;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec3 vColor;
        varying vec3 vWorld;
        ${CLOUD_SHADOW_GLSL}
        void main() {
            vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
            float sunlit = cloudShadow(vWorld.xz);
            float light = 0.75 + 0.35 * max(dot(n, uSun), 0.0) * sunlit + 0.1 * n.y;
            vec3 color = vColor * light * mix(${CLOUD_SHADE_GLSL}, vec3(1.0), sunlit);
            float distance = length(cameraPosition - vWorld);
            float haze = 1.0 - exp(-pow(distance * uFogDensity, 2.0));
            gl_FragColor = vec4(mix(color, uFogColor, haze * uClarity), 1.0);
        }
    `,
});

/** The Kelvin angle a wake's arms spread at. */
const KELVIN = Math.tan((19.5 * Math.PI) / 180);

/**
 * A wake, flat on the water: a quad from the bow back over the area the wake can cover, with the foam drawn in the
 * fragment shader. `along` is how far behind the bow, `across` how far to the side. `size` scales its widths to the
 * boat (1 for the ferry's 25 m beam); `length` is how far it trails; `height` how far above the waterline it's laid.
 */
const createWake = ({ bow, stern, size, length, height }: { bow: number, stern: number, size: number, length: number, height: number }) => {
    const [near, far] = [1.5 * size, length * KELVIN + 4 * size];
    const geometry = new BufferGeometry();
    const corners = [[0, -near], [0, near], [length, far], [length, -far]];
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(corners.flatMap(([along, across]) => [
        bow - along, height, across,
    ])), 3));
    geometry.setAttribute('wake', new BufferAttribute(new Float32Array(corners.flat()), 2));
    geometry.setIndex([0, 2, 1, 0, 3, 2]);

    const material = new ShaderMaterial({
        uniforms: {
            uKelvin: { value: KELVIN },
            uStern: { value: bow - stern },
            uSize: { value: size },
            uLength: { value: length },
            uStrength: { value: 1 },
            uClarity: { value: CLARITY },
            ...photoUniforms,
            ...cloudShadowUniforms,
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        // Wins against the water it's laid just above
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        vertexShader: /* glsl */ `
            attribute vec2 wake;
            varying vec2 vWake;
            varying vec3 vWorld;
            void main() {
                vWake = wake;
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uKelvin;
            uniform float uStern;
            uniform float uSize;
            uniform float uLength;
            uniform float uStrength;
            uniform float uClarity;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            varying vec2 vWake;
            varying vec3 vWorld;
            ${CLOUD_SHADOW_GLSL}
            float foamHash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float foamNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(foamHash(i), foamHash(i + vec2(1.0, 0.0)), u.x),
                    mix(foamHash(i + vec2(0.0, 1.0)), foamHash(i + vec2(1.0, 1.0)), u.x), u.y);
            }
            void main() {
                float along = vWake.x;
                float across = abs(vWake.y);
                // The arms spreading from the bow, broadening and fading as they go
                float armWidth = (0.6 + 0.07 * along) * uSize;
                float arm = exp(-pow((across - along * uKelvin) / armWidth, 2.0)) * exp(-along / (uLength * 0.3)) * 0.7;
                // The churned water behind the stern, spreading slowly and lasting longer
                float behind = along - uStern;
                float trailWidth = (1.3 + 0.07 * max(behind, 0.0)) * uSize;
                float trail = smoothstep(-uSize, uSize, behind) * (1.0 - smoothstep(0.4, 1.0, across / trailWidth))
                    * exp(-max(behind, 0.0) / (uLength * 0.5));
                // Broken up, fixed to the water rather than the boat, so it's left behind as it sails on
                float broken = smoothstep(0.1, 0.6, foamNoise(vWorld.xz * 0.9 / uSize) * foamNoise(vWorld.xz * 0.23 / uSize + 4.0)) * 1.4;
                float foam = clamp(max(arm, trail) * broken, 0.0, 1.0) * uStrength;
                vec3 color = vec3(0.95, 0.97, 1.0) * mix(${CLOUD_SHADE_GLSL}, vec3(1.0), cloudShadow(vWorld.xz));
                float distance = length(cameraPosition - vWorld);
                float haze = 1.0 - exp(-pow(distance * uFogDensity, 2.0));
                gl_FragColor = vec4(mix(color, uFogColor, haze * uClarity), foam * 0.75);
            }
        `,
    });
    const mesh = new Mesh(geometry, material);
    // After the water and the tiles, so it lies over both
    mesh.renderOrder = 1;
    return mesh;
};

/**
 * A boat with its wake, moved along `route` (a centripetal curve through x, z points at `waterline`) by the
 * scroll: `along(progress)` is how far along the route it is, in scene units, and `wakeAt(progress)` how strong its
 * wake is (0..1, for slowing down). Unlit apart from a little shading
 * from the sun, like the tiles, and only drawn while it's on its route.
 */
const createBoat = ({ geometry, route, waterline, scale = 1, wake, along, wakeAt = () => 1, sun }: {
    geometry: BufferGeometry,
    route: number[][],
    waterline: number,
    scale?: number,
    wake: Parameters<typeof createWake>[0],
    along: (progress: number) => number,
    wakeAt?: (progress: number) => number,
    sun: IUniform<Vector3>,
}) => {
    const curve = new CatmullRomCurve3(route.map(([x, z]) => new Vector3(x, waterline, z)), false, 'centripetal');
    const length = curve.getLength();
    const material = createBoatMaterial(sun);
    const wakeMesh = createWake(wake);
    const group = new Group();
    group.add(new Mesh(geometry, material), wakeMesh);
    group.scale.setScalar(scale);
    group.visible = false;
    const tangent = new Vector3();

    return {
        object: group,

        /** Every frame while the city is shown, with the journey's progress. */
        update(progress: number) {
            const u = along(progress) / length;
            group.visible = u >= 0 && u <= 1;
            if (!group.visible) return;
            curve.getPointAt(u, group.position);
            curve.getTangentAt(u, tangent);
            group.rotation.y = Math.atan2(-tangent.z, tangent.x);
            (wakeMesh.material as ShaderMaterial).uniforms.uStrength.value = wakeAt(progress);
        },

        dispose() {
            geometry.dispose();
            material.dispose();
            wakeMesh.geometry.dispose();
            (wakeMesh.material as ShaderMaterial).dispose();
        },
    };
};

// A Stena Superfast-class ro-ro, in scene units: 203 m long, 25 m in the beam. Along +x, its bow forwards.
const FERRY_HALF_BEAM = 1.25;
const FERRY_STERN = -10.15;
const FERRY_BOW = 10.15;
/** The top of the hull, where the superstructure starts. */
const FERRY_DECK = 1.6;
const FERRY_HULL = { deck: FERRY_DECK, bowStart: 4, rake: 0.6 };
/** The hull seen from above: a square transom, straight sides and a fine bow. */
const FERRY_PLAN = [
    [FERRY_STERN, FERRY_HALF_BEAM], [4, FERRY_HALF_BEAM], [7, 1], [9, 0.55], [FERRY_BOW, 0], [9, -0.55], [7, -1],
    [4, -FERRY_HALF_BEAM], [FERRY_STERN, -FERRY_HALF_BEAM],
];

const createFerryGeometry = () => {
    const [navy, red, white, glass, soot] = ['#1c2f63', '#c8102e', '#eef0f2', '#26313f', '#1b1d22'];
    const parts: BufferGeometry[] = [];
    // The hull in navy down to below the water, a red band, then the white upper hull
    parts.push(colored(hull(FERRY_PLAN, -0.8, 1.05, FERRY_HULL), navy));
    parts.push(colored(hull(FERRY_PLAN, 1.05, 1.2, FERRY_HULL), red));
    parts.push(colored(hull(FERRY_PLAN, 1.2, FERRY_DECK, FERRY_HULL), white));

    // Accommodation decks from midships forwards, the bridge with its wings at the front
    parts.push(colored(box(-7.5, 5.6, FERRY_DECK, 2.5, FERRY_HALF_BEAM - 0.08), white));
    parts.push(colored(box(-5, 5, 2.5, 3, FERRY_HALF_BEAM - 0.25), white));
    parts.push(colored(box(4.4, 5.4, 2.5, 2.95, FERRY_HALF_BEAM + 0.05), white));
    // Windows: a band down each side, and the bridge's across the front
    parts.push(colored(box(-7, 5.4, 1.95, 2.1, FERRY_HALF_BEAM - 0.07), glass));
    parts.push(colored(box(5.38, 5.42, 2.62, 2.82, FERRY_HALF_BEAM), glass));
    // A mast on the bridge roof
    parts.push(colored(box(3.6, 3.75, 3, 3.9, 0.06), white));

    // Twin funnels aft, side by side, white with Stena's red band and sooty tops
    for (const z of [-0.55, 0.55]) {
        parts.push(colored(box(-7.1, -6.1, 3, 3.6, 0.24).translate(0, 0, z), white));
        parts.push(colored(box(-7.1, -6.1, 3.6, 3.85, 0.24).translate(0, 0, z), red));
        parts.push(colored(box(-7.1, -6.1, 3.85, 4, 0.24).translate(0, 0, z), soot));
    }
    return mergeGeometries(parts);
};

/**
 * When the ferry starts coming in and when it's tied up (journey progress): through the end of the intro and the
 * craft beat, when the reader's looking east past the cranes with the channel on the left of the view.
 */
const FERRY_ARRIVES = [windows.belfastIntro[1] - 0.01, windows.craft[1]];

/** How far it's come in, 0..1: steaming in at first, then slowing to a stop at its berth. */
const ferryIn = (progress: number) => {
    const t = MathUtils.clamp((progress - FERRY_ARRIVES[0]) / (FERRY_ARRIVES[1] - FERRY_ARRIVES[0]), 0, 1);
    return 1 - (1 - t) ** 2;
};

/**
 * A ferry coming in to Belfast in Stena Line's colours: a hand-built Superfast-class ro-ro, navy hull, red band,
 * white superstructure and twin funnels, with a pale V of a wake and a churned trail behind it that die away as
 * it slows. It comes down Musgrave Channel to a berth by the scroll, on the left of the view past the cranes
 * (Stena's own terminal is out of sight, behind the dry dock). A little bigger than life, so it reads at the 2 km
 * or so it's seen from.
 */
export const createFerry = (sun: IUniform<Vector3>) => createBoat({
    geometry: createFerryGeometry(),
    // Down the middle of Musgrave Channel, from the water mask
    route: [[171.5, -230], [171, -200], [170.6, -170], [169, -155], [168.3, -140], [166, -128], [161, -116]],
    // On the water drawn over the docks (water.ts)
    waterline: 0.1,
    scale: 1.4,
    wake: { bow: FERRY_BOW, stern: FERRY_STERN, size: 1, length: 50, height: 0.05 },
    along: progress => 100 * ferryIn(progress),
    wakeAt: progress => 1 - ferryIn(progress),
    sun,
});

// A Lagan tour boat, in scene units: about 22 m long and 6 m in the beam
const BOAT_HALF_BEAM = 0.3;
const BOAT_STERN = -1.1;
const BOAT_BOW = 1.1;
const BOAT_HULL = { deck: 0.19, bowStart: 0.5, rake: 0.5 };
const BOAT_PLAN = [
    [BOAT_STERN, BOAT_HALF_BEAM], [0.5, BOAT_HALF_BEAM], [0.85, 0.2], [BOAT_BOW, 0], [0.85, -0.2],
    [0.5, -BOAT_HALF_BEAM], [BOAT_STERN, -BOAT_HALF_BEAM],
];

const createRiverBoatGeometry = () => {
    // A little greyer than paint, to sit with the photographed city
    const [navy, white, glass, red] = ['#1f3a5f', '#d8dbdf', '#27323f', '#b3142b'];
    const parts: BufferGeometry[] = [];
    parts.push(colored(hull(BOAT_PLAN, -0.2, 0.15, BOAT_HULL), navy));
    parts.push(colored(hull(BOAT_PLAN, 0.15, 0.19, BOAT_HULL), white));
    // A low saloon, glazed all round under a red roof: low enough to pass under the railway bridge
    parts.push(colored(box(-0.95, 0.55, 0.19, 0.34, BOAT_HALF_BEAM - 0.03), white));
    parts.push(colored(box(-0.9, 0.5, 0.22, 0.31, BOAT_HALF_BEAM - 0.02), glass));
    parts.push(colored(box(-0.97, 0.57, 0.34, 0.36, BOAT_HALF_BEAM - 0.01), red));
    return mergeGeometries(parts);
};

/**
 * Where it's sailing at the start of the Ocula beat, and how fast (scene units per unit of journey progress):
 * coming down the Lagan towards the reader, who's looking south up the river from Lanyon Place, and passing under
 * the camera, and the train on the railway bridge, as the beat ends.
 */
const BOAT_AT_OCULA = 40;
const BOAT_SPEED = 1000;

/**
 * A tour boat coming down the Lagan: navy hull and a low glazed white saloon under a red roof, with its wake. Up
 * close in the Ocula beat, where the ferry is too far off to see. Moved by the scroll.
 */
export const createRiverBoat = (sun: IUniform<Vector3>) => createBoat({
    geometry: createRiverBoatGeometry(),
    // Down the middle of the river from the Ormeau Embankment, past Lanyon Place, to the weir; from the water mask
    route: [
        [-4.3, 117], [3, 109.5], [9.7, 102], [11.3, 95], [11.5, 87.5], [5.6, 80], [-8, 73], [-24, 65.5],
        [-33, 58], [-36.5, 51], [-36.7, 43], [-36.3, 36], [-35.5, 29], [-34.5, 21], [-32, 14],
    ],
    // On the water drawn over the river (water.ts)
    waterline: 0.1,
    wake: { bow: BOAT_BOW, stern: BOAT_STERN, size: 0.24, length: 10, height: 0.05 },
    along: progress => BOAT_AT_OCULA + BOAT_SPEED * (progress - windows.ocula[0]),
    sun,
});
