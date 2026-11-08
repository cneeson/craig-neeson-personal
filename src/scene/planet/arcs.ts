import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import { onEarth, PLACES } from './geo';

const COLOR = new Color('#88b8f2');
const SEGMENTS = 96;
/** The ribbon's half width, in earth radii, thinning towards its ends. */
const HALF_WIDTH = 0.0022;

type Place = keyof typeof PLACES;

/**
 * The arcs out from Belfast to where the work has reached, how far into the beat each one sets off (0 → 1), and
 * which side of where it lands its label goes.
 */
export const ARCS: { to: Place, label: string, delay: number, side: 'left' | 'right' | 'below' }[] = [
    { to: 'paris', label: 'Ankorstore · Paris', delay: 0, side: 'left' },
    { to: 'boston', label: 'Liberty Mutual · Boston', delay: 0.18, side: 'right' },
    { to: 'itasca', label: 'Flexera · Chicago', delay: 0.32, side: 'below' },
];

/** A point `t` (0 → 1) along the great circle from `from` to `to`, lifted off the surface in a curve. */
const along = (from: Vector3, to: Vector3, t: number, lift: number, target: Vector3) => {
    const angle = from.angleTo(to);
    const [a, b] = [Math.sin((1 - t) * angle) / Math.sin(angle), Math.sin(t * angle) / Math.sin(angle)];
    return target.copy(from).multiplyScalar(a).addScaledVector(to, b).normalize()
        .multiplyScalar(1.003 + Math.sin(Math.PI * t) * lift);
};

const createArcGeometry = (from: Vector3, to: Vector3) => {
    const lift = from.angleTo(to) * 0.18;
    const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const progress = new Float32Array((SEGMENTS + 1) * 2);
    const [point, next, side] = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        along(from, to, t, lift, point);
        along(from, to, Math.min(1, t + 1 / SEGMENTS) - (i === SEGMENTS ? 1 / SEGMENTS : 0), lift, next);
        if (i === SEGMENTS) next.subVectors(point, next).add(point);
        // Lying flat against the planet beneath it, so it reads from above
        side.subVectors(next, point).cross(point).normalize().multiplyScalar(HALF_WIDTH * (0.4 + Math.sin(Math.PI * t) * 0.6));
        [1, -1].forEach((sign, j) => {
            point.clone().addScaledVector(side, sign).toArray(positions, (i * 2 + j) * 3);
            progress[i * 2 + j] = t;
        });
    }
    const index: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('progress', new BufferAttribute(progress, 1));
    geometry.setIndex(index);
    return geometry;
};

/**
 * Arcs of light from Belfast out to the headquarters of the companies the work was for, drawn on in turn
 * with a bright head. Driven by `update`, with how far through the beat it is.
 */
export const createArcs = () => {
    const home = onEarth(PLACES.belfast.lat, PLACES.belfast.lon);
    const object = new Group();
    object.visible = false;
    const arcs = ARCS.map(arc => {
        const material = new ShaderMaterial({
            uniforms: { uColor: { value: COLOR }, uDraw: { value: 0 }, uOpacity: { value: 0 } },
            vertexShader: /* glsl */ `
                attribute float progress;
                varying float vProgress;
                void main() {
                    vProgress = progress;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                uniform float uDraw;
                uniform float uOpacity;
                varying float vProgress;
                void main() {
                    if (vProgress > uDraw) discard;
                    float head = exp(-(uDraw - vProgress) * 25.0) * (1.0 - smoothstep(0.97, 1.0, uDraw));
                    // Fading in from where it leaves Belfast
                    float tail = smoothstep(0.0, 0.08, vProgress);
                    gl_FragColor = vec4(uColor * (1.2 + head * 3.0), uOpacity * mix(0.35, 1.0, tail));
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: DoubleSide,
        });
        const end = onEarth(PLACES[arc.to].lat, PLACES[arc.to].lon);
        const mesh = new Mesh(createArcGeometry(home, end), material);
        mesh.renderOrder = 2;
        object.add(mesh);
        return { mesh, material, end, delay: arc.delay };
    });

    /** How far along (0 → 1) each arc has drawn at `amount` through the beat. */
    const drawn = (amount: number, delay: number) => Math.min(1, Math.max(0, (amount - delay) / 0.5));

    return {
        object,
        /** Where each arc lands, in the earth group's space (unit sphere). */
        ends: arcs.map(arc => arc.end),
        drawn,
        update(amount: number, opacity: number) {
            object.visible = opacity > 0.001 && amount > 0;
            arcs.forEach(arc => {
                const t = drawn(amount, arc.delay);
                // Eased so each arc slows as it lands
                arc.material.uniforms.uDraw.value = 1 - (1 - t) ** 3;
                arc.material.uniforms.uOpacity.value = opacity;
            });
        },
        dispose() {
            arcs.forEach(arc => {
                arc.mesh.geometry.dispose();
                arc.material.dispose();
            });
        },
    };
};
