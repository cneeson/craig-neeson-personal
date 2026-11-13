import {
    DoubleSide, Group, MirroredRepeatWrapping, LinearFilter, LinearMipmapLinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
    SphereGeometry, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { clamp01, smoothstep } from '@/services/three';
import { SUN_DIRECTION } from '../earth';

/**
 * The deck's base and top (earth radii from the middle): above the planet's cloud layer (1.01), so it slides over it
 * as the camera comes down, and the camera's through it as the clouds close in (the descent's height is in
 * `approachAt`). Far thicker than real cloud, so it reads as having depth from up here.
 */
const [BASE, TOP] = [1.014, 1.0205];
/** The area its cloud is baked over, out from Belfast (radians across the planet). */
const EXTENT = 0.2;
/** How far out from Belfast the deck reaches (radians across the planet), from up high. */
const REACH = 0.17;
/** How opaque each slice is: a cloud's core, through every slice, is all but solid; its edges, through few, are thin. */
const SLICE_OPACITY = 0.3;
/** How far above the deck (earth radii) the camera is when its cloud starts thickening and joining up. */
const THICKEN_FROM = 0.08;

const noiseChunk = /* glsl */ `
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
    }
`;

/** The flat map of the deck round Belfast, from a point on the sphere: on the plane touching it there, over ±EXTENT. */
const mapChunk = /* glsl */ `
    uniform vec3 uCentre;
    uniform vec3 uEast;
    uniform vec3 uNorth;
`;

/**
 * The cloud, worked out once (it's too much noise to work out per pixel, per slice, every frame): how dense it is
 * (r: billowing, broken cumulus, noise pushed about by broader noise) and how much denser it is towards the sun (g, 0.5
 * for the same: denser that way means this bit's in shadow).
 */
const bakeMaterial = new ShaderMaterial({
    uniforms: {
        uCentre: { value: new Vector3() }, uEast: { value: new Vector3() }, uNorth: { value: new Vector3() },
        uSun: { value: new Vector3() },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        ${mapChunk}
        uniform vec3 uSun;
        varying vec2 vUv;
        ${noiseChunk}
        float fbm(vec3 p, int octaves) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 6; i++) {
                if (i >= octaves) break;
                value += amplitude * noise(p);
                p = p * 2.07 + 13.1;
                amplitude *= 0.5;
            }
            return value;
        }
        float density(vec3 q) {
            vec3 warp = vec3(noise(q * 0.3), noise(q * 0.3 + 7.1), noise(q * 0.3 + 3.3)) - 0.5;
            return fbm(q + warp * 1.6, 6);
        }
        void main() {
            vec2 plane = (vUv * 2.0 - 1.0) * ${EXTENT.toFixed(3)};
            vec3 sphere = normalize(uCentre + uEast * plane.x + uNorth * plane.y);
            vec3 q = sphere * 140.0;
            float d = density(q);
            float toward = density(q + uSun * 0.5) - d;
            gl_FragColor = vec4(d, clamp(0.5 + toward, 0.0, 1.0), 0.0, 1.0);
        }
    `,
    depthTest: false,
    depthWrite: false,
});

/**
 * One slice through the deck, `height` (0 → 1) from its base to its top. The cloud's heaped up: the higher the slice,
 * the denser the cloud has to be to reach it, so each cloud has a broad, flat, shaded base and a narrower, sunlit dome,
 * and the slices' parallax gives it depth as the camera comes down past them. Thinned close to the camera, so it's
 * flown into rather than hit.
 */
const createSliceMaterial = (height: number) => new ShaderMaterial({
    uniforms: {
        uMap: { value: null }, uCentre: { value: new Vector3() }, uEast: { value: new Vector3() },
        uNorth: { value: new Vector3() }, uSunDirection: { value: SUN_DIRECTION }, uOpacity: { value: 0 },
        uTime: { value: 0 }, uThicken: { value: 0 }, uReach: { value: 0.17 },
    },
    vertexShader: /* glsl */ `
        varying vec3 vSphere;
        varying vec3 vUp;
        varying vec3 vWorld;
        void main() {
            vSphere = normalize(position);
            vec4 world = modelMatrix * vec4(position, 1.0);
            vUp = normalize(mat3(modelMatrix) * position);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
        }
    `,
    fragmentShader: /* glsl */ `
        ${mapChunk}
        uniform sampler2D uMap;
        uniform vec3 uSunDirection;
        uniform float uOpacity;
        uniform float uTime;
        uniform float uThicken;
        uniform float uReach;
        varying vec3 vSphere;
        varying vec3 vUp;
        varying vec3 vWorld;
        ${noiseChunk}
        void main() {
            vec3 sphere = normalize(vSphere);
            float away = acos(clamp(dot(sphere, uCentre), -1.0, 1.0));
            if (away > uReach + 0.05) discard;
            vec2 plane = vec2(dot(sphere - uCentre, uEast), dot(sphere - uCentre, uNorth));
            // Drifting slowly
            vec2 uv = plane / ${(EXTENT * 2).toFixed(3)} + 0.5 + vec2(0.0015, 0.0006) * uTime;
            vec4 cloud = texture2D(uMap, uv);
            // Finer than the map holds, for close up
            float d = cloud.r + (noise(sphere * 2200.0 + ${(height * 5.3).toFixed(2)}) - 0.5) * 0.08;
            float h = ${height.toFixed(3)};
            // Rounding off sooner the higher it is: a dome, not a column
            // Spreading and joining up as the camera gets close (uThicken), until it's an unbroken deck
            float threshold = mix(0.37, 0.69, pow(h, 0.75)) - uThicken * mix(0.2, 0.26, h);
            // Out as far as uReach, frayed at the edge. Beyond the baked map it's mirrored, which close to the horizon
            // passes for more of the same, so it seems to carry on round the planet
            float region = 1.0 - smoothstep(uReach * 0.45, uReach, away + (d - 0.5) * 0.08);
            float cover = smoothstep(threshold, threshold + 0.08, d) * mix(region, sqrt(region), uThicken);
            float near = smoothstep(0.0008, 0.006, distance(vWorld, cameraPosition));
            // Thinner seen edge on, towards the horizon, where the slices would show as lines
            float edgeOn = smoothstep(0.04, 0.3, abs(dot(normalize(cameraPosition - vWorld), normalize(vUp))));
            float alpha = cover * near * mix(0.25, 1.0, edgeOn) * uOpacity;
            if (alpha < 0.003) discard;
            // Shaded underneath and on the side away from the sun, bright on top
            float sunlit = clamp(1.0 - (cloud.g - 0.5) * 6.0, 0.0, 1.0);
            float light = mix(0.5, 1.0, pow(h, 0.7)) * mix(0.7, 1.0, sunlit);
            vec3 color = mix(vec3(0.14, 0.16, 0.21), vec3(0.44, 0.46, 0.49), light);
            // Grey through dusk and dark on the night side, like the planet's clouds
            color *= mix(0.05, 1.0, smoothstep(-0.2, 0.3, dot(normalize(vUp), uSunDirection)));
            gl_FragColor = vec4(color, alpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
});

/**
 * A deck of heaped cloud over Belfast, which the camera comes down through after the sign, under the clouds closing
 * in. Drawn as a stack of slices over a map of the cloud baked once (`bake`, before it's shown). Lives in the earth
 * group, over `centre` (Belfast, in the earth group). Driven by `update`.
 */
export const createCloudDeck = (centre: Vector3, { segments, slices, size }: { segments: number, slices: number, size: number }) => {
    const target = new WebGLRenderTarget(size, size, {
        generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, depthBuffer: false,
    });
    target.texture.anisotropy = 8;
    target.texture.wrapS = target.texture.wrapT = MirroredRepeatWrapping;
    const middle = centre.clone().normalize();
    const east = new Vector3(0, 1, 0).cross(middle).normalize();
    const north = middle.clone().cross(east);
    const geometry = new SphereGeometry(1, segments * 2, segments * 2);
    const object = new Group();
    object.visible = false;
    const layers = Array.from({ length: slices }, (_, i) => {
        const height = i / (slices - 1);
        const material = createSliceMaterial(height);
        Object.assign(material.uniforms, {
            uMap: { value: target.texture }, uCentre: { value: middle }, uEast: { value: east }, uNorth: { value: north },
        });
        const mesh = new Mesh(geometry, material);
        const radius = BASE + (TOP - BASE) * height;
        mesh.scale.setScalar(radius);
        // Over the planet's clouds and Northern Ireland's outline, bottom up (the camera's above)
        mesh.renderOrder = 2 + i / slices;
        object.add(mesh);
        return { mesh, material, radius };
    });
    let isBaked = false;

    return {
        object,
        /** Works out the cloud, with the sun as it is with the earth turned `earthRotationY` (on the way down). */
        bake(renderer: WebGLRenderer, earthRotationY: number) {
            const { uniforms } = bakeMaterial;
            uniforms.uCentre.value.copy(middle);
            uniforms.uEast.value.copy(east);
            uniforms.uNorth.value.copy(north);
            uniforms.uSun.value.copy(SUN_DIRECTION).applyAxisAngle(new Vector3(0, 1, 0), -earthRotationY);
            const quad = new Mesh(new PlaneGeometry(2, 2), bakeMaterial);
            quad.frustumCulled = false;
            const scene = new Scene().add(quad);
            const previous = renderer.getRenderTarget();
            renderer.setRenderTarget(target);
            renderer.render(scene, new OrthographicCamera());
            renderer.setRenderTarget(previous);
            quad.geometry.dispose();
            bakeMaterial.dispose();
            isBaked = true;
        },
        /**
         * At `opacity` (0 → 1), with the camera `distance` from the earth's middle (earth radii): thickening as it comes
         * down to it, until it's unbroken and filling the screen. Each slice goes as the
         * camera comes down through it: the clouds have closed in by then, and from under it the deck would show its
         * edge over the horizon.
         */
        update(opacity: number, distance: number, time: number) {
            object.visible = isBaked && opacity > 0.001 && distance > BASE - 0.004;
            if (!object.visible) return;
            // Thickening over the last stretch down to it
            const thicken = smoothstep(clamp01((TOP + THICKEN_FROM - distance) / THICKEN_FROM));
            // Reaching out past the horizon as it comes down, so close to it, it's cloud all round (the horizon's
            // acos(1 / distance) away)
            const reach = Math.max(REACH, Math.acos(Math.min(1, 1 / distance)) * 1.6 * thicken);
            for (const { mesh, material, radius } of layers) {
                const shown = opacity * SLICE_OPACITY * (1 + thicken * 0.5) * (1 - smoothstep(clamp01((radius + 0.0025 - distance) / 0.0025)));
                mesh.visible = shown > 0.001;
                material.uniforms.uOpacity.value = shown;
                material.uniforms.uTime.value = time;
                material.uniforms.uThicken.value = thicken;
                material.uniforms.uReach.value = reach;
            }
        },
        dispose() {
            geometry.dispose();
            layers.forEach(({ material }) => material.dispose());
            target.dispose();
        },
    };
};
