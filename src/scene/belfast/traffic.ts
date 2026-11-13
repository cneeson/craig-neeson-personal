import {
    BoxGeometry, BufferAttribute, BufferGeometry, Color, DataTexture, DoubleSide, FloatType, Group, IUniform,
    InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NearestFilter, Object3D, OrthographicCamera,
    PerspectiveCamera, Points, RGBAFormat, Scene, ShaderMaterial, Texture, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isMobile } from '@/services/device';
import { HOVER_PERIOD, poseOf, shots } from '@/scene/shots';
import { CLOUD_SHADE_GLSL, CLOUD_SHADOW_GLSL, cloudShadowUniforms, photoUniforms } from './photo-materials';

/** traffic.bin stores half-metres; the scene works in 10 m units. */
const HALF_METRE = 0.05;

/** Only roads this close to the camera's shots (scene units) get cars, and only cars this far from the camera are drawn. */
const NEAR_ROUTE = 260;
/** Closer than this a car is a model; further, a point; beyond the last, nothing. */
const MODEL_RANGE = 100;
const POINT_RANGE = 650;
/**
 * The models' size close up, shrinking to the second by the time they're LIFE_SIZE_AT off (scene units), where they'd
 * otherwise stand out against the haze. Small enough to stay inside their lanes on the tiles.
 */
const CAR_SCALE = 0.8;
const FAR_SCALE = 0.5;
const LIFE_SIZE_AT = 80;

/** The roads are resampled at this spacing (scene units) into a texture, one point per texel, for the shader. */
const SPACING = 1;
const ROAD_TEXTURE_WIDTH = 1024;
/** Lanes are 3.5 m wide, and cars keep left. */
const LANE_WIDTH = 0.35;
/** Bumper to bumper, roughly (scene units): fewer on phones. */
const GAP = isMobile ? [12.8, 19.2] : [6.1, 9.6];

/**
 * The heights under the cars come from a top-down render of the tiles this wide (scene units), this many texels (about
 * 6 m a texel), centred this far ahead of the camera (a share of the width), so it reaches out as far as the points.
 */
const HEIGHT_AREA = 1000;
const HEIGHT_SIZE = isMobile ? 896 : 1792;
const HEIGHT_AHEAD = 0.3;
/** The heights are packed into 16 bits over this range (scene units). */
const HEIGHT_RANGE = [-10, 50];

interface Road { points: [number, number][], isOneway: boolean, isFast: boolean, lanes: number }

const decode = (buffer: ArrayBuffer): Road[] => {
    const view = new DataView(buffer);
    if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'BTRF') throw new Error('Not a traffic.bin');
    const roads: Road[] = [];
    let offset = 12;
    for (let r = view.getUint32(8, true); r > 0; r--) {
        const [flags, lanes, count] = [view.getUint8(offset), view.getUint8(offset + 1), view.getUint16(offset + 2, true)];
        offset += 4;
        const points: [number, number][] = [];
        let [x, z] = [0, 0];
        for (let i = 0; i < count; i++, offset += 4) {
            x += view.getInt16(offset, true);
            z += view.getInt16(offset + 2, true);
            points.push([x * HALF_METRE, z * HALF_METRE]);
        }
        roads.push({ points, isOneway: (flags & 1) > 0, isFast: (flags & 2) > 0, lanes });
    }
    return roads;
};

/** Points every SPACING along a polyline. */
const resample = (points: [number, number][]) => {
    const samples: [number, number][] = [points[0]];
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
        const [[ax, az], [bx, bz]] = [points[i - 1], points[i]];
        const length = Math.hypot(bx - ax, bz - az);
        let d = SPACING - carry;
        for (; d <= length; d += SPACING) samples.push([ax + ((bx - ax) * d) / length, az + ((bz - az) * d) / length]);
        carry = length - (d - SPACING);
    }
    return samples;
};

/** The stretches of `samples` within NEAR_ROUTE of the shots, as [from, to) index ranges. */
const nearRoute = (samples: [number, number][], route: [number, number][]) => {
    const runs: [number, number][] = [];
    let from = -1;
    samples.forEach(([x, z], i) => {
        const isNear = route.some(([rx, rz]) => (x - rx) ** 2 + (z - rz) ** 2 < NEAR_ROUTE ** 2);
        if (isNear && from < 0) from = i;
        if (!isNear && from >= 0) {
            runs.push([from, i]);
            from = -1;
        }
    });
    if (from >= 0) runs.push([from, samples.length]);
    // Too short to drive along
    return runs.filter(([a, b]) => b - a > 12);
};

// Most cars are white, black, grey or silver, a few coloured; and now and then a bus: a Glider or a Metro
const PAINT = ['#e8e9eb', '#e8e9eb', '#1d1f22', '#1d1f22', '#6d7177', '#a9adb3', '#a9adb3', '#2c3e66', '#8c1d22', '#3d5a40'];
const BUSES = ['#6c2b8f', '#d0177a'];

/** Seeded, so the traffic is the same on every visit. */
let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/**
 * Lays out the cars: the roads near the shots resampled into a texture (x, z per texel), and per car where its
 * road starts in the texture, how many points it has and its length; its direction (1 along the road, -1 against)
 * and how far left of the middle it drives; how far along it starts and its speed (scene units a second); its
 * colour and length (2.2 for a bus).
 */
const layOut = (roads: Road[]) => {
    // Where the camera goes: each shot, where it drifts to, and the hover's sweep
    const route: [number, number][] = Object.values(shots).flatMap(shot => [0, 60].map(held => {
        const { x, z } = poseOf(shot, held, 0);
        return [x, z] as [number, number];
    }));
    for (let time = 0; time < HOVER_PERIOD; time += 5) {
        const { x, z } = poseOf(shots.home, 0, time);
        route.push([x, z]);
    }

    const samples: number[] = [];
    const cars = { road: [] as number[], lane: [] as number[], motion: [] as number[], color: [] as number[], size: [] as number[] };
    const color = new Color();
    for (const road of roads) {
        const all = resample(road.points);
        for (const [from, to] of nearRoute(all, route)) {
            const start = samples.length / 4;
            all.slice(from, to).forEach(([x, z]) => samples.push(x, z, 0, 0));
            const count = to - from;
            const length = (count - 1) * SPACING;
            const directions = road.isOneway ? [1] : [1, -1];
            for (const direction of directions) {
                for (let lane = 0; lane < road.lanes; lane++) {
                    // Each lane at its own steady speed, so cars in it never catch each other up
                    const speed = (road.isFast ? 2.4 : 1.2) * (0.85 + 0.3 * random());
                    const offset = road.isOneway
                        ? (lane - (road.lanes - 1) / 2) * LANE_WIDTH
                        : (lane + 0.5) * LANE_WIDTH;
                    for (let along = random() * GAP[1]; along < length - 1; along += GAP[0] + random() * (GAP[1] - GAP[0])) {
                        const isBus = !road.isFast && lane === 0 && random() < 0.06;
                        cars.road.push(start, count, length);
                        cars.lane.push(direction, offset);
                        cars.motion.push(along, isBus ? speed * 0.8 : speed);
                        color.set(isBus ? BUSES[Math.floor(random() * BUSES.length)] : PAINT[Math.floor(random() * PAINT.length)])
                            .convertSRGBToLinear();
                        cars.color.push(color.r, color.g, color.b);
                        cars.size.push(isBus ? 2.2 : 1);
                        if (isBus) along += GAP[1];
                    }
                }
            }
        }
    }
    const rows = Math.ceil(samples.length / 4 / ROAD_TEXTURE_WIDTH);
    const data = new Float32Array(ROAD_TEXTURE_WIDTH * rows * 4);
    data.set(samples);
    const texture = new DataTexture(data, ROAD_TEXTURE_WIDTH, rows, RGBAFormat, FloatType);
    texture.minFilter = texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    return { texture, cars };
};

/** A car: x along it (forwards +x), z across (+z on its right), y up from the road. 4.5 m long, 1.8 m wide. */
const createCarGeometry = () => {
    const part = (geometry: BufferGeometry, kind: number) => {
        const piece = geometry.toNonIndexed();
        piece.deleteAttribute('normal');
        piece.deleteAttribute('uv');
        piece.setAttribute('part', new BufferAttribute(new Float32Array(piece.attributes.position.count).fill(kind), 1));
        return piece;
    };
    const box = (x0: number, x1: number, y0: number, y1: number, halfWidth: number) =>
        new BoxGeometry(x1 - x0, y1 - y0, halfWidth * 2).translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return mergeGeometries([
        // 0 paint, 1 glass, 2 headlights, 3 tail lights
        part(box(-0.225, 0.225, 0.025, 0.09, 0.09), 0),
        part(box(-0.13, 0.1, 0.09, 0.135, 0.085), 1),
        part(box(-0.12, 0.09, 0.135, 0.145, 0.08), 0),
        part(box(0.222, 0.228, 0.06, 0.08, 0.075), 2),
        part(box(-0.228, -0.222, 0.06, 0.08, 0.075), 3),
    ]);
};

/** Shared GLSL: where a car is on its road now, from the road texture and the heights under it. */
const ON_ROAD_GLSL = /* glsl */ `
    uniform sampler2D uRoads;
    uniform sampler2D uHeights;
    uniform vec3 uHeightArea;
    uniform float uTime;
    attribute vec3 aRoad;
    attribute vec2 aLane;
    attribute vec2 aMotion;
    attribute vec3 aColor;
    attribute float aSize;

    vec2 roadPoint(float i) {
        int index = int(aRoad.x + clamp(i, 0.0, aRoad.y - 1.0));
        return texelFetch(uRoads, ivec2(index % ${ROAD_TEXTURE_WIDTH}, index / ${ROAD_TEXTURE_WIDTH}), 0).xy;
    }

    // The height of the tiles' surface, from above; far below the ground where they haven't been captured
    float surfaceAt(vec2 xz) {
        vec2 uv = vec2((xz.x - uHeightArea.x) / uHeightArea.z + 0.5, 0.5 - (xz.y - uHeightArea.y) / uHeightArea.z);
        vec4 packed = texture2D(uHeights, uv);
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0))) || packed.a < 0.5) return -1000.0;
        return mix(${HEIGHT_RANGE[0].toFixed(1)}, ${HEIGHT_RANGE[1].toFixed(1)}, packed.r + packed.g / 255.0);
    }

    // How far inside the area the heights cover (0 at its edge, 0.5 in the middle)
    float insideHeights(vec2 xz) {
        vec2 uv = vec2((xz.x - uHeightArea.x) / uHeightArea.z + 0.5, 0.5 - (xz.y - uHeightArea.y) / uHeightArea.z);
        return min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    }

    // The car's position on the road, the way it's heading (x, z) and how much of it is shown (0..1, the models
    // shrinking away at once); and \`fade\` (0..1), the points' slower fade out towards the ends of the road and the
    // edge of the heights, so in the distance they fade away rather than blinking out
    void onRoad(out vec3 position, out vec2 heading, out float shown, out float fade) {
        float length = aRoad.z;
        float travelled = mod(aMotion.x + uTime * aMotion.y, length);
        float along = (aLane.x > 0.0 ? travelled : length - travelled) / ${SPACING.toFixed(1)};
        float i = floor(along);
        // Heading from a little either side, which rounds off the corners
        heading = normalize(roadPoint(i + 2.0) - roadPoint(i - 1.0) + 1e-5) * aLane.x;
        vec2 left = vec2(heading.y, -heading.x);
        vec2 xz = mix(roadPoint(i), roadPoint(i + 1.0), along - i) + left * aLane.y;
        // The lowest of a few points along the road, so it's on the road rather than a lamp post or a tree's edge
        // (under thick trees it's hidden by them, as it would be); and a little either side of it too, off the fast
        // roads, as narrow streets between tall buildings can be thinner than a texel or off by a few metres in the
        // map (the motorways' flyovers would drop to the ground under them)
        bool isFast = aMotion.y > 1.7;
        float ground = 1000.0;
        for (int k = -2; k <= 2; k++) {
            vec2 at = xz + heading * float(k) * 0.5;
            ground = min(ground, surfaceAt(at));
            if (!isFast) ground = min(ground, min(surfaceAt(at + left * 0.6), surfaceAt(at - left * 0.6)));
        }
        position = vec3(xz.x, ground, xz.y);
        // Where the road runs along or under a building in the map, the car can end up on its roof: hidden if the
        // ground to one side is four storeys or so lower. Bridges are lower than that; the motorways' flyovers
        // (the fast lanes, from their speed) aren't, and are left alone.
        float side = 1000.0;
        for (int k = 1; k <= 2; k++) {
            float across = 2.0 * float(k);
            side = min(side, min(surfaceAt(xz + left * across), surfaceAt(xz - left * across)));
        }
        bool isOnRoof = !isFast && side > -100.0 && ground - side > 1.2;
        // Shrunk away at the ends of its road, and wherever the ground isn't known
        float isOnGround = step(-100.0, ground) * (isOnRoof ? 0.0 : 1.0);
        shown = smoothstep(0.0, 3.0, travelled) * smoothstep(0.0, 3.0, length - travelled) * isOnGround;
        fade = smoothstep(0.0, 20.0, travelled) * smoothstep(0.0, 20.0, length - travelled)
            * smoothstep(0.0, 0.08, insideHeights(xz)) * isOnGround;
    }
`;

const HAZE_GLSL = /* glsl */ `
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    vec3 hazed(vec3 color, vec3 world) {
        float distance = length(cameraPosition - world);
        return mix(color, uFogColor, 1.0 - exp(-pow(distance * uFogDensity, 2.0)));
    }
`;

/**
 * Traffic on the main roads near the flight, for the day city, all moved on the GPU: each car's road is a run of
 * points in a texture and it drives along it at its lane's speed, keeping left. Close up the cars are little models
 * (buses now and then), all in one draw call; further off, points in another, tinted by a glint of their headlights
 * towards the camera or tail lights going away. They sit on the tiles, whose heights come from a top-down render of
 * them every so often around the camera (`update`), only ever in the browser, like the tiles themselves.
 */
export const createTraffic = (sun: IUniform<Vector3>) => {
    const group = new Group();
    const uniforms = {
        uRoads: { value: null as Texture | null },
        uHeights: { value: null as Texture | null },
        uHeightArea: { value: new Vector3(0, 0, HEIGHT_AREA) },
        uTime: { value: 0 },
        uSun: sun,
        uPointScale: { value: 1 },
        ...photoUniforms,
        ...cloudShadowUniforms,
    };

    const modelMaterial = new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
            ${ON_ROAD_GLSL}
            attribute float part;
            varying vec3 vColor;
            varying vec3 vWorld;
            varying float vPart;
            void main() {
                vec3 base;
                vec2 heading;
                float shown;
                float fade;
                onRoad(base, heading, shown, fade);
                float distance = length(cameraPosition - base);
                shown *= step(distance, ${MODEL_RANGE.toFixed(1)});
                float scale = mix(${CAR_SCALE.toFixed(1)}, ${FAR_SCALE.toFixed(1)}, smoothstep(${(LIFE_SIZE_AT * 0.3).toFixed(1)}, ${LIFE_SIZE_AT.toFixed(1)}, distance));
                // Buses are longer, and taller
                vec3 local = position * vec3(aSize, aSize > 1.5 ? 1.9 : 1.0, aSize > 1.5 ? 1.15 : 1.0) * scale * shown;
                vec3 forward = vec3(heading.x, 0.0, heading.y);
                vec3 right = vec3(-heading.y, 0.0, heading.x);
                vWorld = base + forward * local.x + vec3(0.0, local.y, 0.0) + right * local.z;
                vColor = aColor;
                vPart = part;
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uSun;
            varying vec3 vColor;
            varying vec3 vWorld;
            varying float vPart;
            ${CLOUD_SHADOW_GLSL}
            ${HAZE_GLSL}
            void main() {
                vec3 color;
                if (vPart > 2.5) color = vec3(0.8, 0.05, 0.03);
                else if (vPart > 1.5) color = vec3(0.95, 0.92, 0.85);
                else {
                    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
                    float sunlit = cloudShadow(vWorld.xz);
                    float light = 0.7 + 0.35 * max(dot(n, uSun), 0.0) * sunlit + 0.1 * n.y;
                    // Glass round the cabin, but its roof the car's colour, as it's mostly seen from above
                    color = (vPart > 0.5 && n.y < 0.7 ? vec3(0.03, 0.04, 0.05) : vColor) * light
                        * mix(${CLOUD_SHADE_GLSL}, vec3(1.0), sunlit);
                }
                gl_FragColor = vec4(hazed(color, vWorld), 1.0);
            }
        `,
    });

    const pointMaterial = new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
            ${ON_ROAD_GLSL}
            uniform float uPointScale;
            varying vec3 vColor;
            varying vec3 vWorld;
            varying float vFade;
            void main() {
                vec3 base;
                vec2 heading;
                float shown;
                float fade;
                onRoad(base, heading, shown, fade);
                float distance = length(cameraPosition - base);
                shown = step(${MODEL_RANGE.toFixed(1)}, distance) * step(distance, ${POINT_RANGE.toFixed(1)});
                vWorld = base + vec3(0.0, 0.16, 0.0);
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
                // About as wide as the car, but never less than a pixel and a half; fading out towards the range
                gl_PointSize = max(0.2 * sqrt(aSize) * uPointScale / gl_Position.w, 1.5);
                vFade = fade * (1.0 - smoothstep(${(POINT_RANGE * 0.5).toFixed(1)}, ${POINT_RANGE.toFixed(1)}, distance));
                if (shown < 0.5 || vFade < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                // A glint of its headlights from ahead, its tail lights from behind (it's daytime: kept under the
                // bloom's threshold)
                float facing = dot(heading, normalize(cameraPosition.xz - base.xz));
                vec3 lights = facing > 0.0 ? vec3(0.9, 0.88, 0.8) : vec3(0.75, 0.06, 0.03);
                vColor = mix(aColor * 0.8, lights, 0.3 * abs(facing));
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vColor;
            varying vec3 vWorld;
            varying float vFade;
            ${HAZE_GLSL}
            void main() {
                if (length(gl_PointCoord - 0.5) > 0.5) discard;
                gl_FragColor = vec4(hazed(vColor, vWorld), vFade);
            }
        `,
        transparent: true,
        depthWrite: false,
    });

    // The heights: the tiles drawn from straight above, each pixel their height packed into red and green
    const heightTarget = new WebGLRenderTarget(HEIGHT_SIZE, HEIGHT_SIZE, { minFilter: NearestFilter, magFilter: NearestFilter });
    uniforms.uHeights.value = heightTarget.texture;
    const heightScene = new Scene();
    heightScene.overrideMaterial = new ShaderMaterial({
        vertexShader: /* glsl */ `
            varying float vHeight;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vHeight = world.y;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vHeight;
            void main() {
                float h = clamp((vHeight - ${HEIGHT_RANGE[0].toFixed(1)}) / ${(HEIGHT_RANGE[1] - HEIGHT_RANGE[0]).toFixed(1)}, 0.0, 1.0);
                gl_FragColor = vec4(floor(h * 255.0) / 255.0, fract(h * 255.0), 0.0, 1.0);
            }
        `,
        side: DoubleSide,
    });
    const heightCamera = new OrthographicCamera(-HEIGHT_AREA / 2, HEIGHT_AREA / 2, HEIGHT_AREA / 2, -HEIGHT_AREA / 2, 1, 1000);
    // North up in the texture
    heightCamera.up.set(0, 0, -1);
    const clearColor = new Color();
    const [lastCentre, centre, forward] = [new Vector3(Infinity, 0, 0), new Vector3(), new Vector3()];
    let lastCapture = -Infinity;

    /** Draws the heights of `tiles` around `centre`. */
    const capture = (renderer: WebGLRenderer, tiles: Object3D) => {
        heightCamera.position.set(centre.x, 500, centre.z);
        heightCamera.lookAt(centre.x, 0, centre.z);
        heightCamera.updateMatrixWorld();
        const [parent, previousTarget, previousAlpha] = [tiles.parent, renderer.getRenderTarget(), renderer.getClearAlpha()];
        renderer.getClearColor(clearColor);
        heightScene.add(tiles);
        renderer.setRenderTarget(heightTarget);
        renderer.setClearColor(0x000000, 0);
        // Cleared by hand: the effect composer turns autoClear off, and without it the first heights (from the
        // coarse tiles still loading, which lie above the finer ones) would win the depth test for good
        renderer.clear();
        renderer.render(heightScene, heightCamera);
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(clearColor, previousAlpha);
        parent?.add(tiles);
        uniforms.uHeightArea.value.set(centre.x, centre.z, HEIGHT_AREA);
    };

    const disposables: { dispose(): void }[] = [modelMaterial, pointMaterial, heightTarget, heightScene.overrideMaterial];

    fetch(`${process.env.BASE_URL}belfast/traffic.bin`)
        .then(response => {
            if (!response.ok) throw new Error(`traffic.bin ${response.status}`);
            return response.arrayBuffer();
        })
        .then(buffer => {
            const { texture, cars } = layOut(decode(buffer));
            uniforms.uRoads.value = texture;
            const attributes = {
                aRoad: [cars.road, 3], aLane: [cars.lane, 2], aMotion: [cars.motion, 2], aColor: [cars.color, 3], aSize: [cars.size, 1],
            } as const;

            const models = new InstancedBufferGeometry().copy(createCarGeometry() as InstancedBufferGeometry);
            models.instanceCount = cars.size.length;
            const points = new BufferGeometry();
            // Positions are worked out in the shader; this only sets the draw count
            points.setAttribute('position', new BufferAttribute(new Float32Array(cars.size.length * 3), 3));
            for (const [name, [values, size]] of Object.entries(attributes)) {
                models.setAttribute(name, new InstancedBufferAttribute(new Float32Array(values), size));
                points.setAttribute(name, new BufferAttribute(new Float32Array(values), size));
            }
            const meshes = [new Mesh(models, modelMaterial), new Points(points, pointMaterial)];
            meshes.forEach(mesh => {
                mesh.frustumCulled = false;
                group.add(mesh);
            });
            disposables.push(texture, models, points);
        })
        .catch(error => console.warn('No traffic', error));

    return {
        object: group,

        /**
         * Every frame while the city is shown. Redraws the heights under the traffic, centred a little ahead of the
         * camera: every second (as finer tiles arrive), more often while it's moving (as new tiles come into view).
         */
        update(elapsed: number, view: PerspectiveCamera, renderer: WebGLRenderer, tiles: Object3D) {
            uniforms.uTime.value = elapsed;
            uniforms.uPointScale.value = renderer.domElement.height / (2 * Math.tan((view.fov * Math.PI) / 360));
            view.getWorldDirection(forward).setY(0).normalize();
            centre.copy(view.position).addScaledVector(forward, HEIGHT_AREA * HEIGHT_AHEAD).setY(0);
            const since = elapsed - lastCapture;
            if ((since > 0.5 && centre.distanceTo(lastCentre) > 4) || since > 1) {
                capture(renderer, tiles);
                lastCentre.copy(centre);
                lastCapture = elapsed;
            }
        },

        dispose() {
            disposables.forEach(item => item.dispose());
        },
    };
};
