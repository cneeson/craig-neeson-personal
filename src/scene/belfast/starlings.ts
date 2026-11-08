import {
    BufferAttribute, BufferGeometry, Color, PerspectiveCamera, Points, ShaderMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { isMobile } from '@/services/device';
import { clamp01, smoothstep } from '@/services/three';
import { photoUniforms } from './photo-materials';

/**
 * Where the flock wheels: over the Lagan just downstream of the weir, ahead of the camera from the Big
 * Fish to City Hall (it faces north-east all the way). Scene units (10 m).
 */
const CENTRE = new Vector3(-22, 13, -12);
/** Half the flock's size: about 200 m long and 140 m deep, as a sheet that curls up to 60 m. */
const EXTENT = new Vector3(10, 5, 7);

const COUNT = isMobile ? 3000 : 6500;

const bufferSize = new Vector2();

/** A starling's wingspan (about 40 cm), in scene units. */
const BIRD_SIZE = 0.04;

/**
 * A starling murmuration. Each bird is a point placed by the vertex shader from the time alone: a thin sheet
 * that drifts, curls, tilts and stretches, with waves running through it. Where it turns edge-on or folds, the
 * birds crowd into the darker bands murmurations are known for. It thins out raggedly towards its edges, with
 * stragglers beyond them. Birds smaller than a pixel fade rather than vanish, so the flock reads as a shifting cloud
 * from a distance. Nothing is simulated or uploaded per frame.
 */
export const createStarlings = () => {
    const seeds = new Float32Array(COUNT * 4);
    const positions = new Float32Array(COUNT * 3);
    let seed = 11;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < COUNT; i++) {
        // Over a thin disc, patchy (denser in some places), thinning out unevenly past a ragged rim into stragglers
        let [x, z, edge] = [0, 0, 0];
        for (;;) {
            const [r, angle] = [Math.sqrt(random()) * 1.6, random() * Math.PI * 2];
            [x, z] = [Math.cos(angle) * r, Math.sin(angle) * r];
            const rim = 1 + 0.25 * Math.sin(angle * 3 + 0.7) + 0.15 * Math.sin(angle * 7 + 2.1) + 0.08 * Math.sin(angle * 13);
            edge = r / rim;
            const patches = 0.5 + 0.25 * Math.sin(x * 4.1 + 1.3) * Math.sin(z * 3.3 + 0.4) + 0.25 * Math.sin((x - z) * 6.7);
            const falloff = Math.max(1 - smoothstep(clamp01((edge - 0.35) / 0.75)), edge < 1.5 ? 0.03 : 0);
            if (random() < patches * falloff) break;
        }
        const thickness = 0.07 * Math.max(1 - edge * edge, 0.15);
        positions.set([x, (random() - 0.5) * thickness, z], i * 3);
        seeds.set([random(), random(), random(), random()], i * 4);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));

    const material = new ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uCentre: { value: CENTRE },
            uExtent: { value: EXTENT },
            uPixelsPerUnit: { value: 1000 },
            uSize: { value: BIRD_SIZE },
            uMinSize: { value: 1 },
            // Dark against the sky, but not black: they're small, and seen through the air
            uColor: { value: new Color(0.075, 0.075, 0.085) },
            ...photoUniforms,
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            uniform vec3 uCentre;
            uniform vec3 uExtent;
            uniform float uPixelsPerUnit;
            uniform float uSize;
            uniform float uMinSize;
            attribute vec4 aSeed;
            varying float vAlpha;
            varying float vDistance;

            mat2 rotation(float angle) {
                float c = cos(angle), s = sin(angle);
                return mat2(c, -s, s, c);
            }

            void main() {
                float t = uTime;
                vec3 p = position;

                // The sheet curls and rolls over itself
                p.y += 0.55 * sin(p.x * 1.8 + t * 0.35) * cos(p.z * 1.4 - t * 0.27)
                    + 0.22 * sin((p.x + p.z) * 3.1 - t * 0.6);

                // Waves running along it bunch the birds into bands, then spread them again
                vec2 waveDirection = vec2(sin(t * 0.11), cos(t * 0.11));
                p.xz += waveDirection * sin(dot(p.xz, waveDirection) * 6.0 - t * 1.8) * 0.09;
                vec2 crossWave = vec2(-waveDirection.y, waveDirection.x);
                p.xz += crossWave * sin(dot(p.xz, crossWave) * 9.0 + t * 1.3) * 0.04;

                // Its outline keeps changing, into lobes and trailing arms
                p.xz += 0.32 * vec2(sin(p.z * 2.1 + t * 0.43), sin(p.x * 1.9 + t * 0.51));
                p.xz += 0.12 * vec2(sin(p.z * 4.3 - t * 0.37), sin(p.x * 4.7 + t * 0.29));

                // Stretching into a ribbon and bunching back up
                float stretch = 0.5 + 0.5 * sin(t * 0.17 + 1.0);
                p.xz *= vec2(mix(0.7, 1.35, stretch), mix(1.2, 0.8, stretch));

                // Tilting, so it turns edge-on (dark and dense) and face-on (pale and spread) in turn
                p.yz = rotation(sin(t * 0.15) * 0.9) * p.yz;
                p.xy = rotation(sin(t * 0.12 + 2.0) * 0.6) * p.xy;
                // And turning slowly as a whole
                p.xz = rotation(t * 0.09 + sin(t * 0.23) * 0.6) * p.xz;

                // The whole flock wanders about its spot
                vec3 centre = uCentre + vec3(sin(t * 0.07) * 5.0, sin(t * 0.13) * 1.5, cos(t * 0.05) * 4.0);
                // Each bird flutters a little about its place
                vec3 flutter = (aSeed.xyz - 0.5) * 0.06 * sin(t * (3.0 + aSeed.w * 4.0) + aSeed.x * 6.28);
                vec3 world = centre + p * uExtent + flutter;

                vec4 view = viewMatrix * vec4(world, 1.0);
                vDistance = -view.z;
                gl_Position = projectionMatrix * view;

                // Never smaller than a (CSS) pixel; birds that would be smaller fade by how much of it they'd cover
                float pixels = uSize * uPixelsPerUnit / max(vDistance, 0.01) / uMinSize;
                gl_PointSize = max(pixels, 1.0) * uMinSize;
                // Wingbeats: each bird's silhouette flickers as it flaps
                float flap = 0.75 + 0.25 * sin(t * 14.0 + aSeed.w * 40.0);
                vAlpha = clamp(pixels * pixels, 0.08, 0.8) * flap;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            varying float vAlpha;
            varying float vDistance;
            void main() {
                float haze = 1.0 - exp(-pow(vDistance * uFogDensity, 2.0));
                gl_FragColor = vec4(mix(uColor, uFogColor, haze), vAlpha);
            }
        `,
        transparent: true,
        depthWrite: false,
    });

    const points = new Points(geometry, material);
    // The shader moves the birds, so the geometry's bounds mean nothing
    points.frustumCulled = false;

    return {
        object: points,
        update(elapsed: number, camera: PerspectiveCamera, renderer: WebGLRenderer) {
            material.uniforms.uTime.value = elapsed;
            // Pixels per scene unit at a distance of one unit, for the current lens and drawing buffer
            const height = renderer.getDrawingBufferSize(bufferSize).y;
            material.uniforms.uPixelsPerUnit.value = height / (2 * Math.tan((camera.fov * Math.PI) / 360));
            material.uniforms.uMinSize.value = renderer.getPixelRatio();
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
};
