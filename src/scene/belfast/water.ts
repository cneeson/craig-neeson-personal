import {
    Color, DataTexture, IUniform, LinearMipmapLinearFilter, Mesh, PlaneGeometry, RepeatWrapping, RGBAFormat,
    ShaderMaterial, Texture, TextureLoader, Vector3,
} from 'three';
import { bounds } from './geo';
import { CLOUD_SHADE_GLSL, CLOUD_SHADOW_GLSL, cloudShadowUniforms, photoUniforms } from './photo-materials';

/** Linear colour from sRGB components (0..1), for shader constants. */
const lin = (r: number, g: number, b: number) => new Color(r, g, b).convertSRGBToLinear();

/**
 * Just above the water in the tiles (at about 0, give or take a metre where they're coarse), and below the
 * quays, so the tiles' own banks, boats and bridges cut the water's edge rather than the coarse mask.
 */
const WATER_LEVEL = 0.1;

/**
 * A tileable ripple normal map: a sum of waves whose frequencies are whole numbers of cycles across the tile,
 * so it repeats seamlessly. Built once, at load, rather than shipping an image.
 */
const createRippleTexture = (size = 256) => {
    const waves: { kx: number, ky: number, amplitude: number, phase: number }[] = [];
    // Seeded, so the water looks the same on every visit
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    while (waves.length < 48) {
        const [kx, ky] = [Math.round((random() * 2 - 1) * 14), Math.round((random() * 2 - 1) * 14)];
        const k = Math.hypot(kx, ky);
        if (k < 2) continue;
        // Most of the energy in the longer waves, as in real chop
        waves.push({ kx, ky, amplitude: 1 / k ** 1.6, phase: random() * Math.PI * 2 });
    }
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let [dx, dy] = [0, 0];
            for (const { kx, ky, amplitude, phase } of waves) {
                const slope = Math.cos(((kx * x + ky * y) / size) * Math.PI * 2 + phase) * amplitude * Math.PI * 2;
                dx += slope * kx;
                dy += slope * ky;
            }
            // Scaled so the steepest ripples tilt the surface by roughly 30°
            const [nx, ny] = [-dx * 0.012, -dy * 0.012];
            const length = Math.hypot(nx, ny, 1);
            const i = (y * size + x) * 4;
            data[i] = ((nx / length) * 0.5 + 0.5) * 255;
            data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
            data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
            data[i + 3] = 255;
        }
    }
    const texture = new DataTexture(data, size, size, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
};

export type SkyUniforms ={ uHaze: IUniform<Color>, uZenith: IUniform<Color>, uSunColor: IUniform<Color>, uSun: IUniform<Vector3> };

/**
 * The river, docks and lough, over the flat water in the tiles: rippling, reflecting the day sky (more of it
 * at grazing angles), with the sun glittering in it. The water areas come from the OpenStreetMap mask
 * (water.png, built by scripts/belfast/water.mjs); the tiles' quays hide its soft edges. It fades out towards the edge of the mask, where the
 * tiles' own water carries on.
 */
export const createWater = (sky: SkyUniforms, anisotropy: number) => {
    const mask = new TextureLoader().load(`${process.env.BASE_URL}belfast/water.png`);
    // water.png's first row is the north edge, which is the plane's minimum z
    mask.flipY = false;
    const ripples = createRippleTexture();
    ripples.anisotropy = anisotropy;

    const material = new ShaderMaterial({
        uniforms: {
            uMask: { value: mask as Texture },
            uRipples: { value: ripples as Texture },
            uTime: { value: 0 },
            uBounds: { value: [bounds.minX, bounds.minZ, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ] },
            uDeep: { value: lin(0.07, 0.12, 0.14) },
            ...sky,
            ...photoUniforms,
            ...cloudShadowUniforms,
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying float vDistance;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vec4 view = viewMatrix * world;
                vDistance = length(view.xyz);
                gl_Position = projectionMatrix * view;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D uMask;
            uniform sampler2D uRipples;
            uniform float uTime;
            uniform vec4 uBounds;
            uniform vec3 uDeep;
            uniform vec3 uHaze;
            uniform vec3 uZenith;
            uniform vec3 uSunColor;
            uniform vec3 uSun;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            varying vec3 vWorld;
            varying float vDistance;
            ${CLOUD_SHADOW_GLSL}

            // The map holds tangent-space normals; swizzled so y is up
            vec3 ripple(vec2 uv) {
                return texture2D(uRipples, uv).xzy * 2.0 - 1.0;
            }

            // The same gradient as the day sky, so reflections match it
            vec3 skyColor(vec3 direction) {
                vec3 color = mix(uHaze, uZenith, pow(max(direction.y, 0.0), 0.55));
                float sun = max(dot(direction, uSun), 0.0);
                return color + uSunColor * pow(sun, 8.0) * 0.12;
            }

            void main() {
                vec2 maskUv = (vWorld.xz - uBounds.xy) / uBounds.zw;
                float water = smoothstep(0.08, 0.45, texture2D(uMask, maskUv).r);
                // Fade out towards the edge of the mask, where the tiles' own water carries on
                vec2 edge = min(maskUv, 1.0 - maskUv) * uBounds.zw;
                water *= smoothstep(0.0, 40.0, min(edge.x, edge.y));
                if (water < 0.01) discard;

                // Two scales of ripples drifting in different directions (1 unit = 10 m)
                vec2 p = vWorld.xz;
                vec3 n1 = ripple(p / 3.1 + vec2(0.021, 0.013) * uTime);
                // Turned against the first, so the two tilings never line up into visible bands
                vec3 n2 = ripple(mat2(0.8, -0.6, 0.6, 0.8) * p / 1.3 + vec2(-0.017, 0.031) * uTime);
                // The fine ripples go first in the distance, where their tiling would show as moiré
                float fine = 0.6 * (1.0 - smoothstep(15.0, 80.0, vDistance));
                vec3 normal = normalize(vec3((n1.x + n2.x * fine) * 1.7, n1.y * mix(1.0, n2.y, fine / 0.6), (n1.z + n2.z * fine) * 1.7));
                // Calmer in the distance, where the ripples are too small to see and would only shimmer
                normal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), smoothstep(20.0, 160.0, vDistance) * 0.85));

                vec3 view = normalize(cameraPosition - vWorld);
                vec3 reflected = reflect(-view, normal);
                reflected.y = abs(reflected.y);
                float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(normal, view), 0.0), 5.0);

                vec3 color = mix(uDeep, skyColor(reflected), fresnel);
                // Glitter: a broad sheen, plus pinpricks bright enough to catch the bloom. None under a cloud.
                float sunlit = cloudShadow(vWorld.xz);
                float sun = max(dot(reflected, uSun), 0.0);
                color *= mix(${CLOUD_SHADE_GLSL}, vec3(1.0), sunlit);
                color += uSunColor * (pow(sun, 60.0) * 0.25 + pow(sun, 900.0) * 6.0) * sunlit;

                float haze = 1.0 - exp(-pow(vDistance * uFogDensity, 2.0));
                // Mostly opaque, hiding the seams in the tiles' water, but letting a little of the photo through
                gl_FragColor = vec4(mix(color, uFogColor, haze), water * mix(0.82, 1.0, fresnel));
            }
        `,
        transparent: true,
        depthWrite: false,
        // Wins against the tiles' water where it's a little higher, mostly at grazing angles
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });

    const geometry = new PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geometry, material);
    mesh.position.set((bounds.minX + bounds.maxX) / 2, WATER_LEVEL, (bounds.minZ + bounds.maxZ) / 2);
    mesh.frustumCulled = false;

    return {
        mesh,
        update(elapsed: number) {
            material.uniforms.uTime.value = elapsed;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
            mask.dispose();
            ripples.dispose();
        },
    };
};
