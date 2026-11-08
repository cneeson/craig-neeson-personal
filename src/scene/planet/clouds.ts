import { MeshBasicMaterial, Vector3 } from 'three';

/** How far the clouds part around the middle of Northern Ireland (radians across the planet). */
const HOLE_RADIUS = 0.032;

/**
 * Lets the planet's (thin) cloud layer gather thickly over Northern Ireland, then part over it like a curtain,
 * with a ragged edge where the cloud bunches up. Patched into the cloud material's shader, so it keeps its map.
 */
export const patchClouds = () => {
    const uniforms = {
        uHoleCentre: { value: new Vector3(0, 1, 0) },
        uCover: { value: 0 },
        uHole: { value: 0 },
    };
    let attached: MeshBasicMaterial | undefined;

    return {
        /** Patches `material` (once). */
        attach(material: MeshBasicMaterial) {
            if (attached === material) return;
            attached = material;
            material.onBeforeCompile = shader => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader = shader.vertexShader
                    .replace('#include <common>', '#include <common>\nvarying vec3 vSphere;')
                    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSphere = normalize(position);');
                shader.fragmentShader = shader.fragmentShader
                    .replace('#include <common>', `#include <common>
                        uniform vec3 uHoleCentre;
                        uniform float uCover;
                        uniform float uHole;
                        varying vec3 vSphere;`)
                    .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
                        float away = acos(clamp(dot(normalize(vSphere), uHoleCentre), -1.0, 1.0));
                        // The cloud's own texture, at other scales, gives the gathered cloud its shape and roughens edges
                        float coarse = texture2D(alphaMap, vAlphaMapUv * 7.0 + 0.37).g;
                        float fine = texture2D(alphaMap, vAlphaMapUv * 19.0 + 0.71).g;
                        float region = 1.0 - smoothstep(${HOLE_RADIUS * 1.3}, ${HOLE_RADIUS * 3.4}, away + (coarse - 0.5) * ${HOLE_RADIUS * 1.6} + (fine - 0.5) * ${HOLE_RADIUS * 0.6});
                        // Gathered thickly over the country, keeping the texture's structure
                        float cloud = texture2D(alphaMap, vAlphaMapUv).g;
                        float thick = 0.7 * smoothstep(0.25, 0.85, cloud * 0.9 + coarse * 0.45 + fine * 0.3);
                        diffuseColor.a = mix(diffuseColor.a, max(diffuseColor.a, thick), uCover * region);
                        // Parted from the middle out, ragged, bunching up a little at the edge
                        float open = uHole * ${HOLE_RADIUS};
                        float edge = away + (coarse - 0.5) * ${HOLE_RADIUS * 1.1} + (fine - 0.5) * ${HOLE_RADIUS * 0.6};
                        float parted = smoothstep(open - ${HOLE_RADIUS * 0.08}, open + ${HOLE_RADIUS * 0.12}, edge);
                        float rim = exp(-pow((edge - open - ${HOLE_RADIUS * 0.2}) / ${HOLE_RADIUS * 0.22}, 2.0));
                        diffuseColor.a = diffuseColor.a * parted + uHole * region * rim * fine * 0.25;`);
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
