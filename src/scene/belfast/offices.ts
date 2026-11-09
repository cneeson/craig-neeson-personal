import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import { windowOpacity, windows, type EmployerBeat } from '@/scene/choreography';

/**
 * The buildings the career walk stops at, outlined in light while their beat is up. Footprints from
 * OpenStreetMap, in scene units (10 m, x east, z south); heights are roughly the buildings' in the tiles.
 */
interface Office {
    beat: EmployerBeat;
    footprint: [number, number][];
    height: number;
}

const OFFICES: Office[] = [
    // Adelaide Exchange, 24–26 Adelaide Street (way 445786641)
    {
        beat: 'liberty',
        height: 3.4,
        footprint: [[-84.2, 119.3], [-84.4, 117.2], [-84.7, 114.2], [-82.2, 114.1], [-82, 118.1], [-80.5, 118.1],
            [-80.6, 115.7], [-81.4, 115.6], [-81.5, 114.7], [-80.8, 114.7], [-81, 111.6], [-81.5, 111.2],
            [-79.8, 111.1], [-79.7, 112], [-79.4, 112], [-78.9, 119.1], [-80.8, 119.1], [-82.6, 119.2]],
    },
    // Flax House, 83–91 Adelaide Street (way 1549697622)
    { beat: 'flexera', height: 3, footprint: [[-85.8, 120.6], [-85.9, 119.3], [-89.4, 119.5], [-89.3, 120.8], [-87, 120.7]] },
    // Ormeau Business Park, 8 Cromac Avenue, in the Gasworks: the western block, where Locate a Locum's unit was (way 363937763)
    { beat: 'locum', height: 1.2, footprint: [[-61.2, 155.7], [-59.2, 163.3], [-61.1, 163.8], [-63.1, 156.2]] },
    // Meadow House, 22 East Bridge Street, by Lanyon station: Formation Works (way 292885433)
    {
        beat: 'ocula',
        height: 3.2,
        footprint: [[-8.7, 86], [-8.6, 88.7], [-7.6, 88.7], [-7.1, 89], [-6.9, 88.6], [-7.1, 87.5], [-6.9, 87.4],
            [-6.9, 87.8], [-5.8, 87.8], [-5.9, 85.9]],
    },
];

/** Sunk a little into the ground, so the outline meets it on slopes. */
const BASE = -0.6;
/** Pushed out from the walls, so the outline isn't hidden inside the building in the tiles. */
const MARGIN = 0.15;

const centreOf = (footprint: [number, number][]) => footprint
    .reduce((sum, [x, z]) => sum.add(new Vector3(x, 0, z)), new Vector3())
    .divideScalar(footprint.length);

/** Where each building's callout points: just over the middle of its roof. */
export const officeAnchors = Object.fromEntries(OFFICES.map(office =>
    [office.beat, centreOf(office.footprint).setY(office.height + 0.4)])) as Partial<Record<EmployerBeat, Vector3>>;

/** Walls round the footprint, with each vertex's height (0..1) and its distance from the nearest corner (m). */
const wallsOf = ({ footprint, height }: Office) => {
    const centre = centreOf(footprint);
    const corners = footprint.map(([x, z]) => {
        const out = new Vector3(x - centre.x, 0, z - centre.z);
        return new Vector3(x, 0, z).addScaledVector(out.normalize(), MARGIN);
    });
    const positions: number[] = [];
    const heights: number[] = [];
    const edges: number[] = [];
    corners.forEach((a, i) => {
        const b = corners[(i + 1) % corners.length];
        const metres = a.distanceTo(b) * 10;
        // Corner lines only at the ends of walls of any length, not along the jogs in a footprint
        const [start, length] = metres < 6 ? [100, 200 + metres] : [0, metres];
        // Two triangles per wall: (a low, b low, b high) and (a low, b high, a high)
        const quad: [Vector3, number, number][] = [
            [a, 0, start], [b, 0, start + metres], [b, 1, start + metres], [a, 0, start], [b, 1, start + metres], [a, 1, start],
        ];
        quad.forEach(([point, up, along]) => {
            positions.push(point.x, up ? height : BASE, point.z);
            heights.push(up);
            edges.push(along, length);
        });
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('aUp', new BufferAttribute(new Float32Array(heights), 1));
    geometry.setAttribute('aEdge', new BufferAttribute(new Float32Array(edges), 2));
    return geometry;
};

const vertexShader = /* glsl */ `
    attribute float aUp;
    attribute vec2 aEdge;
    varying float vUp;
    varying vec2 vEdge;
    void main() {
        vUp = aUp;
        vEdge = aEdge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uRise;
    uniform float uTime;
    varying float vUp;
    varying vec2 vEdge;
    void main() {
        // Rises up the walls as it appears
        if (vUp > uRise) discard;
        float lineWidth = fwidth(vUp) * 1.5;
        float top = 1.0 - smoothstep(0.0, lineWidth, uRise - vUp);
        // Upright lines at the corners (about a metre wide)
        float corner = 1.0 - smoothstep(0.4, 0.8, min(vEdge.x, vEdge.y - vEdge.x));
        // A band scanning up the walls, and a glow up from the ground
        float scan = smoothstep(0.08, 0.0, abs(vUp - fract(uTime * 0.35)));
        float glow = 0.12 + 0.25 * (1.0 - vUp);
        float alpha = clamp(glow + scan * 0.35 + corner * 0.6 + top, 0.0, 1.0);
        gl_FragColor = vec4(uColor * (1.0 + top * 1.5 + corner), alpha * uOpacity);
    }
`;

/** The outlines, shown in turn: through the buildings in front faintly, clearly where they're in view. */
export const createOfficeHighlights = () => {
    const group = new Group();
    group.visible = false;
    const highlights = OFFICES.map(office => {
        const geometry = wallsOf(office);
        const uniforms = { uColor: { value: new Color('#88b8f2') }, uOpacity: { value: 0 }, uRise: { value: 0 }, uTime: { value: 0 } };
        const material = (seen: boolean) => new ShaderMaterial({
            uniforms: seen ? uniforms : { ...uniforms, uOpacity: { value: 0 } },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            depthTest: seen,
            side: DoubleSide,
            blending: AdditiveBlending,
        });
        const [seen, hidden] = [new Mesh(geometry, material(true)), new Mesh(geometry, material(false))];
        // The faint pass, through whatever's in front, is drawn first
        hidden.renderOrder = 1;
        seen.renderOrder = 2;
        group.add(hidden, seen);
        return { office, geometry, seen, hidden, uniforms };
    });

    return {
        object: group,
        /** Every frame, with the journey's progress, the time (s) and whether the city is shown. */
        update(progress: number, elapsed: number, isInCity: boolean) {
            group.visible = isInCity;
            if (!isInCity) return;
            highlights.forEach(({ office, seen, hidden, uniforms }) => {
                const [start, end] = windows[office.beat];
                const opacity = windowOpacity(progress, [start - 0.004, end]);
                seen.visible = hidden.visible = opacity > 0.001;
                if (!seen.visible) return;
                const rise = Math.min(1, Math.max(0, (progress - start + 0.004) / 0.01));
                uniforms.uOpacity.value = opacity;
                uniforms.uRise.value = 1 - (1 - rise) ** 3;
                uniforms.uTime.value = elapsed;
                (hidden.material as ShaderMaterial).uniforms.uOpacity.value = opacity * 0.3;
            });
        },
        dispose() {
            highlights.forEach(({ geometry, seen, hidden }) => {
                geometry.dispose();
                (seen.material as ShaderMaterial).dispose();
                (hidden.material as ShaderMaterial).dispose();
            });
        },
    };
};
