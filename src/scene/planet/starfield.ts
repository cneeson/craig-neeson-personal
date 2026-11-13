import {
    AdditiveBlending, BufferAttribute, BufferGeometry, Color, MathUtils, Points, ShaderMaterial, Vector3,
} from 'three';
import { BAND_NORMAL } from './nebula';

/**
 * The stars, as pinpoints at an infinite distance: kept around the camera, so they don't slide past each other as it
 * moves, and drawn a fixed number of pixels across, round and soft. Most are faint and a few bright (only those
 * reach the bloom), each a little warm or cool, but only just, and a few faintly coloured. Like the Milky Way's, the
 * faint ones crowd along the nebula's band, in clumps, and thin out away from it.
 */

// Star colours from hot to cool, then mostly greyed back towards white
const TINTS = ['#9bb0ff', '#cad7ff', '#ffffff', '#fff4ea', '#ffd2a1', '#ffcc6f'].map(hex => new Color(hex));
const TINT_WEIGHTS = [0.08, 0.2, 0.34, 0.22, 0.11, 0.05];
const SATURATION = 0.4;
// And a few in soft colours no star really is (rose, lilac, aqua, mint), still mostly white
const PASTELS = ['#ff9ec4', '#c3a6ff', '#8fe3f0', '#a8f0c6'].map(hex => new Color(hex));
const PASTEL_SHARE = 0.14;
const PASTEL_SATURATION = 0.65;
const RADIUS = 300;

export type StarLayer = {
    /** How many. */
    count: number;
    /** Brightness range (linear; the bloom starts at about 0.3), skewed towards the faint end. */
    brightness: [number, number];
    /** Size range (CSS pixels). */
    size: [number, number];
    /** How much they gather along the band (0 evenly spread, 1 none away from it). */
    band?: number;
};

/** How crowded the sky is along `dir` (0..1): the band's core, a broader glow round it, and clumps along it. */
const bandDensity = (dir: Vector3) => {
    const off = dir.dot(BAND_NORMAL);
    const across = Math.max(Math.exp(-((off / 0.15) ** 2)), 0.45 * Math.exp(-((off / 0.4) ** 2)));
    const clumps = 0.65 + 0.35 * Math.sin(dir.x * 11 + 1.3) * Math.sin(dir.y * 9 - 0.7) * Math.sin(dir.z * 13 + 2.1);
    return across * clumps;
};

const pickTint = () => {
    let r = Math.random();
    const index = TINT_WEIGHTS.findIndex(weight => (r -= weight) < 0);
    return TINTS[index < 0 ? 2 : index];
};

const white = new Color(1, 1, 1);

export const createStarLayer = ({ count, brightness, size, band = 0 }: StarLayer, pixelRatio: number) => {
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const point = new Vector3();
    const colour = new Color();
    for (let i = 0; i < count; i++) {
        // Kept as often as the sky's crowded there
        do point.randomDirection();
        while (Math.random() > 1 - band + band * bandDensity(point));
        point.multiplyScalar(RADIUS).toArray(positions, i * 3);
        const strength = Math.random() ** 3;
        const isPastel = Math.random() < PASTEL_SHARE;
        const tint = isPastel ? PASTELS[Math.floor(Math.random() * PASTELS.length)] : pickTint();
        colour.copy(white).lerp(tint, isPastel ? PASTEL_SATURATION : SATURATION).convertSRGBToLinear()
            .multiplyScalar(MathUtils.lerp(brightness[0], brightness[1], strength));
        colour.toArray(colours, i * 3);
        sizes[i] = MathUtils.lerp(size[0], size[1], strength) * pixelRatio;
        phases[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colours, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));

    const material = new ShaderMaterial({
        uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `
            attribute vec3 aColor;
            attribute float aSize;
            attribute float aPhase;
            uniform float uTime;
            varying vec3 vColor;
            void main() {
                // A faint, slow twinkle
                vColor = aColor * (0.88 + 0.12 * sin(uTime * (0.6 + fract(aPhase * 7.3)) + aPhase));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize;
            }`,
        fragmentShader: /* glsl */ `
            uniform float uOpacity;
            varying vec3 vColor;
            void main() {
                float d = length(gl_PointCoord - 0.5) * 2.0;
                float alpha = exp(-d * d * 5.0) * uOpacity;
                if (alpha < 0.004) discard;
                gl_FragColor = vec4(vColor, alpha);
            }`,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
    });

    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = -5;

    return {
        points,
        material,

        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
};
