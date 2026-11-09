import { MeshBasicMaterial, Vector3 } from 'three';
import { SUN_DIRECTION } from '../earth';

/** How far the clouds part around the middle of Northern Ireland (radians across the planet), on average. */
const HOLE_RADIUS = 0.095;

/** Smooth 3D value noise (0 → 1) and a few octaves of it, over the cloud sphere. */
const noiseChunk = /* glsl */ `
    float cloudHash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float cloudNoise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(cloudHash(i), cloudHash(i + vec3(1, 0, 0)), f.x),
                mix(cloudHash(i + vec3(0, 1, 0)), cloudHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(cloudHash(i + vec3(0, 0, 1)), cloudHash(i + vec3(1, 0, 1)), f.x),
                mix(cloudHash(i + vec3(0, 1, 1)), cloudHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
    }
    float cloudFbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            value += amplitude * cloudNoise(p);
            p = p * 2.03 + 11.7;
            amplitude *= 0.5;
        }
        return value;
    }
`;

/**
 * Lights the planet's (thin) cloud layer by the sun, and lets it gather thickly over Northern Ireland, then part over it, opening out from
 * the middle into an uneven gap with soft, wispy edges. Patched into the cloud material's shader, so it keeps its
 * map.
 */
export const patchClouds = () => {
    const uniforms = {
        uHoleCentre: { value: new Vector3(0, 1, 0) },
        uCover: { value: 0 },
        uHole: { value: 0 },
        uSunDirection: { value: SUN_DIRECTION },
    };
    let attached: MeshBasicMaterial | undefined;
    const r = HOLE_RADIUS;

    return {
        /** Patches `material` (once). */
        attach(material: MeshBasicMaterial) {
            if (attached === material) return;
            attached = material;
            material.onBeforeCompile = shader => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', '#include <common>\nvarying vec3 vSphere;\nvarying vec3 vUp;')
                    .replace('#include <begin_vertex>', `#include <begin_vertex>
                        vSphere = normalize(position);
                        vUp = normalize(mat3(modelMatrix) * position);`);
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', `#include <common>
                        uniform vec3 uHoleCentre;
                        uniform float uCover;
                        uniform float uHole;
                        uniform vec3 uSunDirection;
                        varying vec3 vSphere;
                        varying vec3 vUp;
                        ${noiseChunk}`)
                    .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
                        vec3 sphere = normalize(vSphere);
                        float away = acos(clamp(dot(sphere, uHoleCentre), -1.0, 1.0));
                        // Broad lobes give the gap its shape, finer noise frays its edge
                        float shape = cloudFbm(sphere * 8.0 + 3.1);
                        float detail = cloudFbm(sphere * 42.0 + 7.3);
                        float warp = (shape - 0.5) * ${r * 1.6} + (detail - 0.5) * ${r * 0.55};
                        // Gathered thickly over and around the country, keeping the texture's structure
                        float region = 1.0 - smoothstep(${r * 1.7}, ${r * 3.4}, away + warp * 1.3);
                        float cloud = texture2D(alphaMap, vAlphaMapUv).g;
                        float thick = 0.62 * smoothstep(0.2, 0.85, cloud * 0.8 + detail * 0.45 + shape * 0.3);
                        diffuseColor.a = mix(diffuseColor.a, max(diffuseColor.a, thick), uCover * region);
                        // Parted from the middle out, thinning gradually towards the gap
                        float edge = away + warp;
                        float open = uHole * ${r};
                        float parted = smoothstep(open - ${r * 0.3}, open + ${r * 0.4}, edge);
                        parted = mix(1.0, parted, smoothstep(0.0, 0.2, uHole));
                        // A little denser where the cloud's been pushed back
                        float rim = exp(-pow((edge - open - ${r * 0.45}) / ${r * 0.4}, 2.0));
                        diffuseColor.a *= parted * (1.0 + rim * 0.35 * uHole * region);
                        // Lit by the sun: grey through dusk and all but gone on the night side
                        diffuseColor.rgb *= mix(0.05, 1.0, smoothstep(-0.2, 0.3, dot(normalize(vUp), uSunDirection)));`);
            };
            material.needsUpdate = true;
        },

        /** Where they part (in the cloud mesh's own space), how thickly they've gathered (0 → 1) and how far parted. */
        update(centre: Vector3, cover: number, hole: number) {
            uniforms.uHoleCentre.value.copy(centre).normalize();
            uniforms.uCover.value = cover;
            uniforms.uHole.value = hole;
        },
    };
};
