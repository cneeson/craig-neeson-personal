import {
    AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, ShapeUtils, Vector2, Vector3,
} from 'three';
import { NORTHERN_IRELAND } from './northern-ireland';
import { onEarth } from './geo';

const COLOR = new Color('#88b8f2');

/** Just above the land and below the clouds (at 1.01), so the clouds can roll back over it. */
const OUTLINE_RADIUS = 1.0025;
const FILL_RADIUS = 1.002;
/** Half the outline's width, in earth radii: a few pixels from where the camera looks at it. */
const HALF_WIDTH = 0.0007;

const points = NORTHERN_IRELAND.map(([lon, lat]) => onEarth(lat, lon));

/**
 * The outline as a ribbon lying on the surface, with how far round it each vertex is (0 → 1) so it can be
 * traced on.
 */
const createOutlineGeometry = () => {
    const count = points.length + 1;
    const positions = new Float32Array(count * 2 * 3);
    const along = new Float32Array(count * 2);
    const lengths = points.map((point, i) => point.distanceTo(points[(i + 1) % points.length]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const [tangent, side] = [new Vector3(), new Vector3()];
    let travelled = 0;
    for (let i = 0; i < count; i++) {
        const point = points[i % points.length];
        tangent.subVectors(points[(i + 1) % points.length], points[(i - 1 + points.length) % points.length]);
        side.crossVectors(tangent, point).normalize().multiplyScalar(HALF_WIDTH);
        [1, -1].forEach((sign, j) => {
            const vertex = point.clone().multiplyScalar(OUTLINE_RADIUS).addScaledVector(side, sign);
            vertex.toArray(positions, (i * 2 + j) * 3);
            along[i * 2 + j] = travelled / total;
        });
        if (i < points.length) travelled += lengths[i];
    }
    const index: number[] = [];
    for (let i = 0; i < count - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('along', new BufferAttribute(along, 1));
    geometry.setIndex(index);
    return geometry;
};

/** The land inside the outline, triangulated flat (it's small enough not to bulge) and lifted onto the sphere. */
const createFillGeometry = () => {
    const flat = NORTHERN_IRELAND.map(([lon, lat]) => new Vector2(lon * Math.cos((lat * Math.PI) / 180), lat));
    const triangles = ShapeUtils.triangulateShape(flat, []);
    const positions = new Float32Array(points.length * 3);
    // North to south (0 → 1), for the scan passing over it
    const lats = NORTHERN_IRELAND.map(([, lat]) => lat);
    const [south, north] = [Math.min(...lats), Math.max(...lats)];
    const sweep = new Float32Array(points.length);
    points.forEach((point, i) => {
        point.clone().multiplyScalar(FILL_RADIUS).toArray(positions, i * 3);
        sweep[i] = (north - NORTHERN_IRELAND[i][1]) / (north - south);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('sweep', new BufferAttribute(sweep, 1));
    geometry.setIndex(triangles.flat());
    return geometry;
};

/**
 * Northern Ireland picked out on the planet: its outline traced on in light, with a bright head, then the
 * land inside tinted as a scan passes over it from north to south. Driven by `update`.
 */
export const createHighlight = () => {
    const outlineMaterial = new ShaderMaterial({
        uniforms: { uColor: { value: COLOR }, uDraw: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
            attribute float along;
            varying float vAlong;
            void main() {
                vAlong = along;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uDraw;
            uniform float uOpacity;
            varying float vAlong;
            void main() {
                if (vAlong > uDraw) discard;
                // Brighter towards the head as it's traced, settling once it's complete
                float head = exp(-(uDraw - vAlong) * 30.0) * (1.0 - smoothstep(0.97, 1.0, uDraw));
                gl_FragColor = vec4(uColor * (1.4 + head * 3.0), uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // The triangulation and ribbon don't promise a winding
        side: DoubleSide,
    });
    const fillMaterial = new ShaderMaterial({
        uniforms: { uColor: { value: COLOR }, uOpacity: { value: 0 }, uScan: { value: -1 } },
        vertexShader: /* glsl */ `
            attribute float sweep;
            varying float vSweep;
            void main() {
                vSweep = sweep;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uScan;
            varying float vSweep;
            void main() {
                float scan = exp(-pow((vSweep - uScan) * 9.0, 2.0));
                gl_FragColor = vec4(uColor, uOpacity * (0.16 + scan * 0.5));
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // The triangulation and ribbon don't promise a winding
        side: DoubleSide,
    });

    const outline = new Mesh(createOutlineGeometry(), outlineMaterial);
    const fill = new Mesh(createFillGeometry(), fillMaterial);
    // Drawn after the planet's surface, before the clouds
    outline.renderOrder = fill.renderOrder = 1;
    const object = new Group();
    object.add(fill, outline);
    object.visible = false;

    return {
        object,
        /** `draw` traces the outline (0 → 1), `fill` tints the land, `scan` passes over it (0 → 1), all faded by `opacity`. */
        update(draw: number, fillAmount: number, scan: number, opacity: number) {
            object.visible = opacity > 0.001 && draw > 0;
            outlineMaterial.uniforms.uDraw.value = draw;
            outlineMaterial.uniforms.uOpacity.value = opacity;
            fillMaterial.uniforms.uOpacity.value = opacity * fillAmount;
            fillMaterial.uniforms.uScan.value = scan * 1.3 - 0.15;
        },
        dispose() {
            outline.geometry.dispose();
            fill.geometry.dispose();
            outlineMaterial.dispose();
            fillMaterial.dispose();
        },
    };
};
