import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import type { EmployerBeat } from '@/scene/director';
import type { ToScene } from './telescope';

/**
 * The buildings the experience stops at, outlined in light while they're shown. Footprints from
 * OpenStreetMap, in scene units (10 m, x east, z south); heights are roughly the buildings' in the tiles. Out at Antrim
 * and Coleraine they're placed in the tiles' own frame (east, north and up from ORIGIN on the WGS84 ellipsoid): the
 * flat conversion in geo.ts is fine over Belfast but drifts by over 100 m at Antrim and nearly a kilometre at Coleraine.
 */
interface Office {
    beat: EmployerBeat;
    footprint: [number, number][];
    /** The roof's height, and the ground's where it isn't at 0 (out where the tiles' plane leaves the earth). */
    height: number;
    ground?: number;
    /** Where the roof steps: each wall's own height (from each corner to the next), in place of `height`. */
    tops?: number[];
    /**
     * A pitched roof: `height` is then the eaves', and the walls rise to the ridges' where they pass under them. The
     * ridges run along `along`, `count` of them side by side (a row of gables), evenly across the footprint.
     */
    ridge?: { height: number; along: [number, number]; count?: number };
    /**
     * Far off round the earth (Paris), where nothing flat holds: the footprint is then in scene units east (x) and south
     * (z) of this place, the heights above the WGS84 ellipsoid, and it's placed through the tiles once they're set up.
     */
    at?: { lat: number; lon: number };
}

const OFFICES: Office[] = [
    // Adelaide Exchange, 24–26 Adelaide Street (way 445786641): the west wing and the range along the south are taller
    // than the east wing
    {
        beat: 'liberty',
        height: 3.7,
        tops: [3.7, 3.7, 3.7, 3.7, 3.7, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.2, 3.7, 3.7, 3.7],
        footprint: [[-84.2, 119.3], [-84.4, 117.2], [-84.7, 114.2], [-82.2, 114.1], [-82, 118.1], [-80.5, 118.1],
            [-80.6, 115.7], [-81.4, 115.6], [-81.5, 114.7], [-80.8, 114.7], [-81, 111.6], [-81.5, 111.2],
            [-79.8, 111.1], [-79.7, 112], [-79.4, 112], [-78.9, 119.1], [-80.8, 119.1], [-82.6, 119.2]],
    },
    // Flax House, 83–91 Adelaide Street (way 1549697622), moved onto the building in the tiles
    { beat: 'flexera', height: 2.1, footprint: [[-86, 121.1], [-86.1, 119.8], [-89.6, 120], [-89.5, 121.3], [-87.2, 121.2]] },
    // Ormeau Business Park, 8 Cromac Avenue, in the Gasworks: the middle one of the western block's six units, where
    // Locate a Locum was, under two of the row of gables across the block. Placed from the tiles (the block's footprint in
    // OSM, way 363937763, is off by 6 m)
    {
        beat: 'locum',
        height: 1,
        ridge: { height: 1.2, along: [1, -0.26], count: 2 },
        footprint: [[-60.73, 159.58], [-60.39, 160.89], [-62.42, 161.42], [-62.76, 160.12]],
    },
    // Meadow House, 22 East Bridge Street, by Lanyon station: Formation Works (way 292885433, redrawn from the tiles, as
    // it's 6 m off)
    { beat: 'ocula', height: 2, footprint: [[-8.6, 86.5], [-6, 86.5], [-6, 88.7], [-8.6, 88.7]] },
    // Nitec, 9 Technology Park, Antrim, 21 km off: only seen through the telescope (way 242023209)
    {
        beat: 'antrim',
        height: 1.2,
        ground: 0.3,
        footprint: [[-1819.4, -1098.4], [-1816.6, -1097.7], [-1816.1, -1099.3], [-1819.7, -1100.1], [-1822.9, -1098.6],
            [-1822.6, -1098], [-1822.3, -1097.3]],
    },
    // Ulster University's Coleraine campus, 78 km off and only seen through the telescope. Outside the photorealistic
    // tiles (just terrain and aerial photos), so its buildings are only outlines; the ground there is about 45 units
    // down, with the earth's curve
    // Ulster University (way 190664585)
    {
        beat: 'coleraine',
        height: -44.1,
        ground: -45.5,
        footprint: [[-4853.5, -6098.6], [-4850.3, -6101.5], [-4850.1, -6101.3], [-4848.9, -6102.4], [-4855.1, -6109.3],
            [-4855.9, -6110.1], [-4857.2, -6109], [-4860.3, -6106.2], [-4859.2, -6105], [-4858.9, -6104.6],
            [-4857.9, -6105.5], [-4858.4, -6106.1], [-4856.1, -6108.2], [-4855.4, -6107.4], [-4854.1, -6106],
            [-4854.5, -6105.7], [-4857.1, -6103.4], [-4856.8, -6103.1], [-4857.3, -6102.7], [-4856.4, -6101.8],
            [-4853.1, -6104.8], [-4851.4, -6102.9], [-4854.8, -6100]],
    },
    // Ulster University (way 188910036)
    {
        beat: 'coleraine',
        height: -44.1,
        ground: -45.5,
        footprint: [[-4853.5, -6098.6], [-4852.8, -6097.8], [-4852.1, -6098.5], [-4851.9, -6098.3], [-4851, -6097.2],
            [-4850, -6096.2], [-4849.7, -6095.8], [-4850.4, -6095.2], [-4850.1, -6094.8], [-4849.6, -6094.3],
            [-4849, -6093.6], [-4851.4, -6091.5], [-4851.8, -6091.1], [-4853.3, -6092.7], [-4853.7, -6093.2],
            [-4855.6, -6095.2], [-4856.3, -6096.1], [-4854.9, -6097.4]],
    },
    // Sports Centre (way 687386101)
    {
        beat: 'coleraine',
        height: -44.5,
        ground: -45.5,
        footprint: [[-4858.1, -6141.3], [-4858.6, -6141], [-4861.5, -6139.2], [-4860.5, -6137.6], [-4858.5, -6134.1],
            [-4854.8, -6136.2]],
    },
    // SAAD Building (way 353290392)
    {
        beat: 'coleraine',
        height: -44.1,
        ground: -45.5,
        footprint: [[-4875, -6129], [-4872.5, -6126.1], [-4872.2, -6126.4], [-4871.8, -6126], [-4872, -6125.8],
            [-4870.2, -6123.6], [-4870.9, -6123], [-4870.5, -6122.6], [-4870.9, -6122.3], [-4871.3, -6122.7],
            [-4872, -6122], [-4874.2, -6124.5], [-4874.7, -6124.1], [-4875.1, -6124.6], [-4874.7, -6124.9],
            [-4876.9, -6127.3], [-4876.1, -6128], [-4876.6, -6128.6], [-4876.2, -6129], [-4875.7, -6128.4]],
    },
    // Diamond Hall (way 1487247078)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4863.2, -6088.2], [-4859.7, -6091.5], [-4860.3, -6092.1], [-4859.5, -6092.9], [-4856.8, -6089.8],
            [-4857.6, -6089.1], [-4861.1, -6085.9]],
    },
    // Biomedical Building (way 190664586)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4866, -6109.8], [-4864.1, -6107.8], [-4859.9, -6111.8], [-4859.5, -6112.2], [-4861.4, -6114.2]],
    },
    // UUSU (way 188910451)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4861.6, -6084.4], [-4862.2, -6083.8], [-4862.6, -6084.2], [-4863.2, -6083.7], [-4863.1, -6083.5],
            [-4863.6, -6083.1], [-4865.7, -6085.4], [-4865.4, -6085.7], [-4864.5, -6086.5], [-4864.8, -6086.8],
            [-4863.2, -6088.2], [-4861.1, -6085.9], [-4860.3, -6085.1], [-4860.1, -6085.3], [-4859, -6084.1],
            [-4860.3, -6082.9]],
    },
    // Teaching Block (way 353290399)
    {
        beat: 'coleraine',
        height: -44.1,
        ground: -45.5,
        footprint: [[-4868.9, -6133.9], [-4868.2, -6134.5], [-4867.1, -6135.4], [-4864.7, -6132.7], [-4864.9, -6132.5],
            [-4864.4, -6132], [-4864.2, -6132.2], [-4863, -6130.7], [-4862.8, -6130.3], [-4863.1, -6129.8],
            [-4863.7, -6129.7], [-4864.1, -6129.8], [-4864.4, -6130.2], [-4866.1, -6128.7], [-4867, -6129.8],
            [-4865.9, -6130.8]],
    },
    // Ulster University (way 786488321)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4855.9, -6110.1], [-4855.1, -6110.9], [-4856.3, -6112.2], [-4854.5, -6113.4], [-4853.4, -6115.2],
            [-4850.7, -6112.3], [-4852.5, -6111.2], [-4853.9, -6109.3], [-4854.5, -6110.1], [-4855.1, -6109.3]],
    },
    // The Bridge (way 1487247079)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4856.8, -6089.8], [-4859.5, -6092.9], [-4858.5, -6093.8], [-4858.5, -6093.3], [-4858.4, -6092.8],
            [-4855.6, -6095.2], [-4853.7, -6093.2], [-4856.8, -6090.5], [-4856.5, -6090.1]],
    },
    // Ulster University (way 476925485)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4852.4, -6087.8], [-4852, -6088.1], [-4851.1, -6087.1], [-4853.1, -6085.3], [-4853.2, -6085.4],
            [-4853.6, -6085.1], [-4854.2, -6084.5], [-4857.7, -6088.2], [-4857.2, -6088.6], [-4856.7, -6089.1],
            [-4854, -6086.3], [-4852.9, -6087.3], [-4853.4, -6087.9], [-4854.1, -6087.2], [-4855, -6088.3],
            [-4854.6, -6088.7], [-4853.8, -6089.4]],
    },
    // Ulster University (way 1100891958)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4848.6, -6093.2], [-4846.6, -6091.1], [-4848.8, -6089.1], [-4849.6, -6090], [-4850.8, -6088.9],
            [-4851.9, -6090.1], [-4851, -6091]],
    },
    // Riverside Theatre (way 187785997)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4867, -6088.8], [-4866, -6088.7], [-4864.3, -6090.2], [-4864, -6090.5], [-4865.7, -6092.4],
            [-4866.7, -6092.5], [-4868.1, -6091.1], [-4868.2, -6090.1]],
    },
    // Ulster University (way 1487250199)
    {
        beat: 'coleraine',
        height: -44.3,
        ground: -45.5,
        footprint: [[-4853.5, -6098.6], [-4854.9, -6097.4], [-4855.6, -6098.2], [-4855.8, -6098.5], [-4858.6, -6101.5],
            [-4857.9, -6102.2], [-4857.3, -6102.7], [-4856.4, -6101.8], [-4854.8, -6100]],
    },
    // Tower (way 188910037)
    {
        beat: 'coleraine',
        height: -42.0,
        ground: -45.5,
        footprint: [[-4848.9, -6095.9], [-4849.2, -6096.2], [-4846.6, -6098.6], [-4845.5, -6097.4], [-4848.2, -6095],
            [-4848.4, -6095.3], [-4849.6, -6094.3], [-4850.1, -6094.8]],
    },
    // Octagon Hall (way 1336800068)
    {
        beat: 'coleraine',
        height: -44.5,
        ground: -45.5,
        footprint: [[-4860.4, -6092], [-4861.9, -6093.6], [-4860, -6095.4], [-4858.5, -6093.8], [-4859.5, -6092.9],
            [-4860.3, -6092.1]],
    },
    // Centre for Environmental Spacial Data Analysis (way 529672125)
    {
        beat: 'coleraine',
        height: -44.5,
        ground: -45.5,
        footprint: [[-4860.3, -6106.2], [-4862.5, -6104.2], [-4861.4, -6103.1], [-4859.2, -6105]],
    },
    // Ulster University (way 476925489)
    {
        beat: 'coleraine',
        height: -44.5,
        ground: -45.5,
        footprint: [[-4864.1, -6107.3], [-4862.9, -6105.9], [-4861.2, -6107.5], [-4862.4, -6108.8]],
    },
    // Ankorstore's office in Paris, seen through the binoculars: the Morning Auber co-working space, 6 rue Auber,
    // through to the rue des Mathurins (way 69224179; the ground's about 9 units above the ellipsoid there)
    {
        beat: 'ankorstore',
        at: { lat: 48.87257, lon: 2.32995 },
        height: 11.4,
        ground: 9,
        footprint: [[-0.75, -3.44], [-1.73, 1.86], [-1.27, 2.25], [-0.5, 2.91], [0.13, 3.45], [0.71, 0.24], [1.02, -1.4],
            [1.35, -3.22]],
    },
];

/** Puts a point in the scene: x, z and y as in the footprints, in scene units. */
type Place = (x: number, z: number, y: number) => Vector3;
const flat: Place = (x, z, y) => new Vector3(x, y, z);

/** Sunk a little into the ground, so the outline meets it on slopes. */
const BASE = -0.6;
/** Pushed out from the walls, so the outline isn't hidden inside the building in the tiles. */
const MARGIN = 0.15;

const centreOf = (footprint: [number, number][]) => footprint
    .reduce((sum, [x, z]) => sum.add(new Vector3(x, 0, z)), new Vector3())
    .divideScalar(footprint.length);

/** Where each building's callout points: just over the middle of its roof. */
export const officeAnchors = Object.fromEntries(OFFICES.filter(office => !office.at).map(office =>
    [office.beat, centreOf(office.footprint).setY((office.ridge?.height ?? office.height) + 0.4)])) as Partial<Record<EmployerBeat, Vector3>>;

/** Walls round the footprint, with each vertex's height (0..1) and its distance from the nearest corner (m). */
const wallsOf = ({ footprint, height, ground = 0, ridge, tops }: Office, place: Place = flat) => {
    const centre = centreOf(footprint);
    const corners = footprint.map(([x, z]) => {
        const out = new Vector3(x - centre.x, 0, z - centre.z);
        return new Vector3(x, 0, z).addScaledVector(out.normalize(), MARGIN);
    });
    // Across the ridges: how far over each point is (0..count, the gables' eaves at whole numbers), and so how high
    // the wall's top is there
    const count = ridge?.count ?? 1;
    const across = ridge ? new Vector3(-ridge.along[1], 0, ridge.along[0]).normalize() : new Vector3();
    const offsets = corners.map(corner => corner.clone().sub(centre).dot(across));
    const [low, high] = [Math.min(...offsets), Math.max(...offsets)];
    const over = (point: Vector3) => (point.clone().sub(centre).dot(across) - low) / (high - low) * count;
    const topAt = (point: Vector3, wall: number) => ridge
        ? height + (ridge.height - height) * (1 - Math.abs((over(point) % 1) * 2 - 1))
        : tops?.[wall] ?? height;

    const positions: number[] = [];
    const heights: number[] = [];
    const edges: number[] = [];
    corners.forEach((a, i) => {
        const b = corners[(i + 1) % corners.length];
        const metres = a.distanceTo(b) * 10;
        // Corner lines only at the ends of walls of any length, not along the jogs in a footprint
        const [start, length] = metres < 6 ? [100, 200 + metres] : [0, metres];
        // Split wherever the wall passes under a ridge or a valley, so its top follows the roof
        const [from, to] = [over(a), over(b)].map(value => value * 2);
        const turns = ridge ? Array.from({ length: count * 2 - 1 }, (_, j) => j + 1)
            .filter(turn => (turn - from) * (turn - to) < 0)
            .map(turn => (turn - from) / (to - from))
            .sort((x, y) => x - y) : [];
        const stops = [a, ...turns.map(t => a.clone().lerp(b, t)), b];
        stops.slice(1).forEach((q, j) => {
            const p = stops[j];
            const [alongP, alongQ] = [start + a.distanceTo(p) * 10, start + a.distanceTo(q) * 10];
            // Two triangles per piece: (p low, q low, q high) and (p low, q high, p high)
            const quad: [Vector3, number, number][] = [
                [p, 0, alongP], [q, 0, alongQ], [q, 1, alongQ], [p, 0, alongP], [q, 1, alongQ], [p, 1, alongP],
            ];
            quad.forEach(([point, up, along]) => {
                const { x, y, z } = place(point.x, point.z, up ? topAt(point, i) : ground + BASE);
                positions.push(x, y, z);
                heights.push(up);
                edges.push(along, length);
            });
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
        // Those far off are drawn once they can be placed
        const geometry = office.at ? new BufferGeometry() : wallsOf(office);
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
    let isLocated = false;

    return {
        object: group,
        /** Once the tiles are set up, places the buildings far off round the earth, through `toScene` (photo-city.ts). */
        locate(toScene: ToScene) {
            if (isLocated) return;
            isLocated = true;
            highlights.forEach(highlight => {
                const { at } = highlight.office;
                if (!at) return;
                const metres = 111320;
                const east = metres * Math.cos((at.lat * Math.PI) / 180);
                const place: Place = (x, z, y) => toScene({ lat: at.lat - (z * 10) / metres, lon: at.lon + (x * 10) / east, height: y * 10 }, new Vector3());
                const geometry = wallsOf(highlight.office, place);
                highlight.seen.geometry = highlight.hidden.geometry = geometry;
                highlight.geometry.dispose();
                highlight.geometry = geometry;
            });
        },
        /** Every frame, with how strongly each is outlined (0 → 1), the time (s) and whether the city is shown. */
        update(amounts: Record<EmployerBeat, number>, elapsed: number, isInCity: boolean) {
            group.visible = isInCity;
            if (!isInCity) return;
            highlights.forEach(({ office, seen, hidden, uniforms }) => {
                const opacity = amounts[office.beat];
                seen.visible = hidden.visible = opacity > 0.001;
                if (!seen.visible) return;
                // Rising up the walls as it appears
                const rise = Math.min(1, opacity * 1.4);
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
