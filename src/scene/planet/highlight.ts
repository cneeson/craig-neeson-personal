import {
    AdditiveBlending, NormalBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, ShapeUtils, Vector2, Vector3,
} from 'three';
import { NORTHERN_IRELAND } from './northern-ireland';
import { onEarth } from './geo';

const COLOR = new Color('#88b8f2');
/** The border's colour: a cool white, kept under the bloom's threshold on the way down so it stays a crisp line. */
const OUTLINE_COLOR = new Color('#e4ecf6');

/** Just above the land and below the clouds (at 1.01), so the clouds can roll back over it. */
const OUTLINE_RADIUS = 1.0025;
const FILL_RADIUS = 1.002;
/**
 * Half the outline's width: a steady width on screen (in earth radii per unit of distance from the camera), but no
 * thinner than `MIN_HALF_WIDTH` (earth radii) close up.
 */
const HALF_WIDTH_PER_DISTANCE = 0.0003;
const MIN_HALF_WIDTH = 0.0007;

const points = NORTHERN_IRELAND.map(([lon, lat]) => onEarth(lat, lon));

/**
 * The outline as a ribbon lying on the surface, with how far round it each vertex is (0 → 1) so it can be
 * traced on. Both edges start on the line, with the way out to their side (`side`); the shader sets the width.
 */
const createOutlineGeometry = () => {
    const count = points.length + 1;
    const positions = new Float32Array(count * 2 * 3);
    const along = new Float32Array(count * 2);
    const sides = new Float32Array(count * 2 * 3);
    const lengths = points.map((point, i) => point.distanceTo(points[(i + 1) % points.length]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const [tangent, side] = [new Vector3(), new Vector3()];
    let travelled = 0;
    for (let i = 0; i < count; i++) {
        const point = points[i % points.length];
        tangent.subVectors(points[(i + 1) % points.length], points[(i - 1 + points.length) % points.length]);
        side.crossVectors(tangent, point).normalize();
        [1, -1].forEach((sign, j) => {
            point.clone().multiplyScalar(OUTLINE_RADIUS).toArray(positions, (i * 2 + j) * 3);
            side.clone().multiplyScalar(sign).toArray(sides, (i * 2 + j) * 3);
            along[i * 2 + j] = travelled / total;
        });
        if (i < points.length) travelled += lengths[i];
    }
    const index: number[] = [];
    for (let i = 0; i < count - 1; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('along', new BufferAttribute(along, 1));
    geometry.setAttribute('side', new BufferAttribute(sides, 3));
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
 * Northern Ireland picked out on the planet: its outline faded in as a solid line of white, then the
 * land inside tinted as a scan passes over it from north to south. Driven by `update`.
 */
export const createHighlight = () => {
    const outlineMaterial = new ShaderMaterial({
        uniforms: { uColor: { value: OUTLINE_COLOR }, uDraw: { value: 0 }, uErase: { value: 0 }, uDim: { value: 1 } },
        vertexShader: /* glsl */ `
            attribute float along;
            attribute vec3 side;
            varying float vAlong;
            void main() {
                vAlong = along;
                // As wide on screen from orbit as on the way down: in the mesh's units, by how far off the camera is
                float scale = length(modelMatrix[0].xyz);
                float distance = length((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition) / scale;
                float halfWidth = max(${MIN_HALF_WIDTH}, distance * ${HALF_WIDTH_PER_DISTANCE});
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position + side * halfWidth, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uDraw;
            uniform float uErase;
            uniform float uDim;
            void main() {
                // The whole outline fades in (uDraw) and out (uErase), rather than being traced along its length
                float alpha = smoothstep(0.0, 1.0, uDraw) * (1.0 - uErase);
                if (alpha < 0.002) discard;
                // Dimmed by darkening rather than fading, so it stays solid (and under the bloom from orbit)
                gl_FragColor = vec4(uColor * 0.9 * uDim, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        // Laid over the land rather than added to it, so it reads as a solid line
        blending: NormalBlending,
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
                gl_FragColor = vec4(uColor, uOpacity * (0.1 + scan * 0.24));
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
        /**
         * `draw` fades the outline in (0 → 1), `fill` tints the land, `scan` passes over it (0 → 1), and `opacity` fades
         * it all away; `dim` darkens the outline alone.
         */
        update(draw: number, fillAmount: number, scan: number, opacity: number, dim = 1) {
            object.visible = opacity > 0.001 && (draw > 0 || fillAmount > 0);
            outlineMaterial.uniforms.uDraw.value = draw;
            outlineMaterial.uniforms.uErase.value = 1 - opacity;
            outlineMaterial.uniforms.uDim.value = dim;
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
