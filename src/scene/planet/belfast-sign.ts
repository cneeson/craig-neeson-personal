import {
    CanvasTexture, Color, DoubleSide, Euler, Group, Mesh, PerspectiveCamera, PlaneGeometry, Quaternion, RingGeometry, ShaderMaterial,
    SRGBColorSpace, Texture, Vector3,
} from 'three';
import { clamp01, smoothstep } from '@/services/three';

/** How big the sign is (earth radii): the contour's radius, with the lettering inside it. */
const RADIUS = 0.03;
/**
 * The site's cream for the lettering's face, and a pale ice blue for the contours, each on a dark shadow so it reads
 * over white cloud as well as space; their sides, back into the depth, a cool slate, as if lit from the front.
 */
const LETTERING = '#f4efe6';
const RING = new Color('#dfe9f7');
const SIDE = new Color('#5f6f8c');
const SHADE = 'rgba(9, 1, 24, 0.95)';
/** How deep the lettering and the rings are, and how many slices make up that depth. */
const LETTER_DEPTH = RADIUS * 0.05;
const RING_DEPTH = RADIUS * 0.03;
const SLICES = 10;
/** The sign's turned a little from square to the camera, so its depth shows as the camera comes in. */
const TILT = new Quaternion().setFromEuler(new Euler(0.12, -0.07, 0.02));
/** How many letters it takes each one to come in, overlapping the next ones. */
const LETTER_OVERLAP = 2.5;
const MAX_LETTERS = 24;
/** How much bigger it is on portrait screens (a phone's), where it would otherwise be small across the narrow frame. */
const PORTRAIT_SCALE = 0.35;

/**
 * A soft dark glow behind the sign, thickest in the middle and gone past the ring, so the cream lettering and the pale
 * contours have something to stand on over white cloud.
 */
const createBackdrop = () => new Mesh(
    new PlaneGeometry(RADIUS * 3, RADIUS * 3),
    new ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
            varying vec2 vPosition;
            void main() {
                vPosition = position.xy;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uOpacity;
            varying vec2 vPosition;
            void main() {
                float r = length(vPosition) / ${RADIUS.toFixed(5)};
                float glow = 1.0 - smoothstep(0.2, 1.35, r);
                gl_FragColor = vec4(0.004, 0.0, 0.012, uOpacity * glow * glow * 0.6);
            }
        `,
        transparent: true,
        depthWrite: false,
    }),
);

/** 0 → 1 over [from, to] of `t`, eased. */
const span = (t: number, from: number, to: number) => smoothstep(clamp01((t - from) / (to - from)));

interface Lettering { text: string, font: string, weight: number, size: number, y: number, spacing?: number }

/**
 * A line of text drawn on canvases (once its type has loaded, and before, in a fallback) for a plane of `width` ×
 * `height`: its face, on a dark shadow, and a plain copy for its sides. `edges` are where each letter starts and the
 * last one ends, across the plane (0..1), so the shader can bring them in one by one.
 */
const createText = (width: number, height: number, { text, font, weight, size, y, spacing = 0 }: Lettering) => {
    const canvases = [0, 1].map(() => document.createElement('canvas'));
    const textures = canvases.map(canvas => {
        [canvas.width, canvas.height] = [1024, Math.round((1024 * height) / width)];
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
    });
    const edges = new Array<number>(MAX_LETTERS + 1).fill(1);
    const draw = () => {
        canvases.forEach((canvas, i) => {
            // letterSpacing is newer than TypeScript's DOM types
            const context = canvas.getContext('2d') as CanvasRenderingContext2D & { letterSpacing: string };
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.font = `${weight} ${size}px ${font}`;
            context.letterSpacing = `${spacing}px`;
            context.textAlign = 'left';
            context.textBaseline = 'middle';
            context.fillStyle = i ? '#ffffff' : LETTERING;
            // Letter spacing trails the last letter too, so it's taken off to centre the line
            const total = context.measureText(text).width - spacing;
            const left = (canvas.width - total) / 2;
            [...text].forEach((_, letter) => {
                edges[letter] = (left + context.measureText(text.slice(0, letter)).width) / canvas.width;
            });
            edges[text.length] = (left + total) / canvas.width;
            if (i) {
                context.fillText(text, left, y);
            } else {
                context.shadowColor = SHADE;
                // Twice: a broad shadow, then a tighter one to edge the letters
                context.shadowBlur = canvas.height * 0.16;
                context.fillText(text, left, y);
                context.shadowBlur = canvas.height * 0.04;
                context.fillText(text, left, y);
            }
            textures[i].needsUpdate = true;
        });
    };
    draw();
    document.fonts.load(`${weight} ${size}px ${font.split(',')[0]}`).then(draw, () => undefined);
    return { face: textures[0], side: textures[1], edges, count: text.length };
};

/**
 * One slice of a line of lettering: its face, or (`side`) a plain slice of its depth, tinted. The letters come in one
 * by one as `uReveal` goes 0 → 1, each fading up and rising into place.
 */
const createSlice = (texture: Texture, width: number, height: number, edges: number[], count: number, side: boolean) => new Mesh(
    new PlaneGeometry(width, height),
    new ShaderMaterial({
        uniforms: {
            uMap: { value: texture }, uReveal: { value: 0 }, uOpacity: { value: 0 }, uEdges: { value: edges },
            uTint: { value: SIDE },
        },
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D uMap;
            uniform float uReveal;
            uniform float uOpacity;
            uniform float uEdges[${MAX_LETTERS + 1}];
            uniform vec3 uTint;
            varying vec2 vUv;
            void main() {
                // Which letter this column is in (the shadow before the first going with it)
                float letter = 0.0;
                for (int i = 1; i < ${count}; i++) {
                    if (vUv.x >= uEdges[i]) letter = float(i);
                }
                float shown = clamp((uReveal * (${count.toFixed(1)} + ${LETTER_OVERLAP.toFixed(1)}) - letter) / ${LETTER_OVERLAP.toFixed(1)}, 0.0, 1.0);
                shown = shown * shown * (3.0 - 2.0 * shown);
                vec2 uv = vec2(vUv.x, vUv.y + (1.0 - shown) * 0.22);
                vec4 text = texture2D(uMap, uv);
                if (uv.y > 1.0) text.a = 0.0;
                ${side ? 'text.rgb = uTint;' : ''}
                gl_FragColor = vec4(text.rgb, text.a * shown * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    }),
);

/** A line of lettering with depth: slices of its side stacked behind its face. */
const createLine = (width: number, height: number, lettering: Lettering) => {
    const { face, side, edges, count } = createText(width, height, lettering);
    const group = new Group();
    for (let i = SLICES; i >= 1; i--) {
        const slice = createSlice(side, width, height, edges, count, true);
        slice.position.z = -(i / SLICES) * LETTER_DEPTH;
        group.add(slice);
    }
    group.add(createSlice(face, width, height, edges, count, false));
    return group;
};

/**
 * A thin ice-blue ring on a soft dark shadow (or, `side`, a plain slate slice of its depth), drawn on round from the top (`uDraw`, 0 → 1; clockwise, or the other way with
 * `reverse`) with a brighter head while it's drawing, solid or dashed (`dashes` round it).
 */
const createContour = (inner: number, outer: number, { dashes = 0, reverse = false, side = false } = {}) => {
    const pad = RADIUS * 0.035;
    return new Mesh(
        new RingGeometry(inner - pad, outer + pad, 192, 1),
        new ShaderMaterial({
            uniforms: { uColor: { value: side ? SIDE : RING }, uDraw: { value: 0 }, uOpacity: { value: 0 } },
            vertexShader: /* glsl */ `
                varying vec2 vPosition;
                void main() {
                    vPosition = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uColor;
                uniform float uDraw;
                uniform float uOpacity;
                varying vec2 vPosition;
                void main() {
                    // How far round from the top, clockwise (0 → 1)
                    float along = fract(atan(${reverse ? '-' : ''}vPosition.x, vPosition.y) / 6.2832 + 1.0);
                    if (along > uDraw) discard;
                    float dash = ${dashes > 0 ? `step(0.5, fract(along * ${dashes.toFixed(1)}))` : '1.0'};
                    float r = length(vPosition);
                    float width = fwidth(r);
                    float line = smoothstep(${inner.toFixed(5)} - width, ${inner.toFixed(5)}, r)
                        * (1.0 - smoothstep(${outer.toFixed(5)}, ${outer.toFixed(5)} + width, r));
                    float shade = ${side ? '0.0' : `exp(-pow((r - ${((inner + outer) / 2).toFixed(5)}) / ${(pad * 0.5).toFixed(5)}, 2.0)) * 0.55`};
                    float head = exp(-(uDraw - along) * 40.0) * (1.0 - step(1.0, uDraw));
                    vec3 color = mix(vec3(0.004, 0.0, 0.01), uColor * (1.0 + head * 0.3), line);
                    gl_FragColor = vec4(color, uOpacity * dash * max(line * (0.85 + head * 0.15), shade));
                }
            `,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
        }),
    );
};

const uniformsOf = (mesh: Mesh) => (mesh.material as ShaderMaterial).uniforms;
/** Sets a uniform on every slice of `group`. */
const set = (group: Group, key: string, value: number) => group.children.forEach(slice => {
    uniformsOf(slice as Mesh)[key].value = value;
});

/**
 * Belfast named on the way down: its name in the scene, inside a contour, hung over Belfast as the camera comes down so
 * it comes up to it and flies on through. It's kept square to the camera. Driven by `update`.
 */
export const createBelfastSign = () => {
    const nameSize = [RADIUS * 1.5, RADIUS * 0.4] as const;
    const name = createLine(...nameSize, { text: 'Belfast', font: 'Fraunces, Georgia, serif', weight: 600, size: 200, y: 150 });
    const countrySize = [RADIUS * 1.5, RADIUS * 0.15] as const;
    const country = createLine(...countrySize, {
        text: 'NORTHERN IRELAND', font: 'Satoshi, Helvetica, Arial, sans-serif', weight: 900, size: 64, y: 52, spacing: 17,
    });
    // Above the middle, so they read clear of Northern Ireland's outline, with Belfast in the middle of the contour
    const [nameY, countryY] = [RADIUS * 0.5, RADIUS * 0.22];
    // The ring, with its depth behind it
    const ring = new Group();
    for (let i = SLICES; i >= 0; i--) {
        const slice = createContour(RADIUS * 0.985, RADIUS, { side: i > 0 });
        slice.position.z = -(i / SLICES) * RING_DEPTH;
        ring.add(slice);
    }
    const outer = createContour(RADIUS * 1.16, RADIUS * 1.17, { dashes: 96, reverse: true });
    // A ripple out from the ring as it closes
    const ripple = createContour(RADIUS * 0.99, RADIUS);
    uniformsOf(ripple).uDraw.value = 1;
    // At different depths, so they shift against each other as the camera comes in: the dashed ring furthest back,
    // the lettering out in front of the ring
    outer.position.z = -RADIUS * 0.18;
    const backdrop = createBackdrop();
    backdrop.position.z = -RADIUS * 0.25;
    name.position.set(0, nameY, RADIUS * 0.1);
    country.position.set(0, countryY, RADIUS * 0.08);
    const object = new Group();
    object.add(backdrop, outer, ripple, ring, country, name);
    // In front of the cloud deck under it (which is drawn after the planet's clouds), back to front
    let order = 10;
    object.traverse(child => {
        if (child instanceof Mesh) child.renderOrder = order++;
    });
    object.visible = false;
    const toCamera = new Vector3();

    return {
        object,
        /**
         * Hangs the sign `distance` ahead of the camera towards `over` (Belfast, which the camera looks at on the way
         * down), turned a little from square to the camera. `enter` (0 → 1) draws it on: the ring round, the dashed ring the other way after it,
         * a ripple as the ring closes, then the name letter by letter and the country under it. `opacity` takes it away, and
         * close up the lettering goes first, the contours following as they sweep out past the edges of the screen.
         */
        update(camera: PerspectiveCamera, over: Vector3, distance: number, enter: number, opacity: number) {
            const near = distance / RADIUS;
            object.visible = enter > 0 && opacity > 0.001 && near > 0.05;
            if (!object.visible) return;
            toCamera.subVectors(over, camera.position).normalize();
            object.position.copy(camera.position).addScaledVector(toCamera, distance);
            object.quaternion.copy(camera.quaternion).multiply(TILT);
            object.scale.setScalar(1 + PORTRAIT_SCALE * clamp01((1 - camera.aspect) / 0.55));

            const rings = opacity * smoothstep(clamp01((near - 0.15) / 0.6));
            set(ring, 'uDraw', span(enter, 0, 0.6));
            set(ring, 'uOpacity', rings * 0.95);
            uniformsOf(outer).uDraw.value = span(enter, 0.2, 0.75);
            uniformsOf(outer).uOpacity.value = rings * 0.55;
            const rippling = clamp01((enter - 0.6) / 0.24);
            ripple.scale.setScalar(1 + (1 - (1 - rippling) ** 3) * 0.45);
            uniformsOf(ripple).uOpacity.value = rippling > 0 && rippling < 1 ? rings * 0.6 * (1 - rippling) ** 2 : 0;

            const lettering = opacity * smoothstep(clamp01((near - 1) / 1.5));
            set(name, 'uReveal', clamp01((enter - 0.575) / 0.33));
            set(name, 'uOpacity', lettering);
            set(country, 'uReveal', clamp01((enter - 0.72) / 0.28));
            set(country, 'uOpacity', lettering);
            // Gathering as the ring draws, and gone with the lettering close up, so it never fills the screen
            uniformsOf(backdrop).uOpacity.value = lettering * span(enter, 0, 0.6);
        },
        dispose() {
            object.traverse((child) => {
                if (!(child instanceof Mesh)) return;
                child.geometry.dispose();
                const material = child.material as ShaderMaterial;
                (material.uniforms.uMap?.value as Texture | undefined)?.dispose();
                material.dispose();
            });
        },
    };
};
