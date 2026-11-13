import {
    CanvasTexture, Color, DoubleSide, Group, Mesh, PerspectiveCamera, PlaneGeometry, RingGeometry, ShaderMaterial, SRGBColorSpace, Texture,
    Vector3,
} from 'three';
import { clamp01, smoothstep } from '@/services/three';

/** How big the sign is (earth radii): the contour's radius, with the lettering inside it. */
const RADIUS = 0.03;
/**
 * The site's peach (as the hero's note), for the lettering and the contours, each on a dark shadow, so it reads over
 * white cloud as well as space.
 */
const PEACH_CSS = '#f6b98a';
const PEACH = new Color(PEACH_CSS);
/** The lettering's a warmer, richer peach than the rings: the light one read as beige against its dark shadow. */
const LETTERING = '#ffa36b';
const SHADE = 'rgba(9, 1, 24, 0.95)';

/** 0 → 1 over [from, to] of `t`, eased. */
const span = (t: number, from: number, to: number) => smoothstep(clamp01((t - from) / (to - from)));

/** Text drawn on a canvas (once its type has loaded, and before, in a fallback) for a plane of `width` × `height`. */
const createText = (width: number, height: number, font: string, paint: (context: CanvasRenderingContext2D & { letterSpacing: string }) => void) => {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [1024, Math.round((1024 * height) / width)];
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    const draw = () => {
        // letterSpacing is newer than TypeScript's DOM types
        const context = canvas.getContext('2d') as CanvasRenderingContext2D & { letterSpacing: string };
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = LETTERING;
        context.shadowColor = SHADE;
        // Twice: a broad shadow, then a tighter one to edge the letters
        context.shadowBlur = canvas.height * 0.16;
        paint(context);
        context.shadowBlur = canvas.height * 0.04;
        paint(context);
        texture.needsUpdate = true;
    };
    draw();
    document.fonts.load(font).then(draw, () => undefined);
    return texture;
};

/** A line of lettering (with its shadow), wiped on from the left (`uReveal`, 0 → 1) with a soft edge. */
const createLine = (texture: Texture, width: number, height: number) => new Mesh(
    new PlaneGeometry(width, height),
    new ShaderMaterial({
        uniforms: { uMap: { value: texture }, uReveal: { value: 0 }, uOpacity: { value: 0 } },
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
            varying vec2 vUv;
            void main() {
                float wipe = smoothstep(vUv.x, vUv.x + 0.18, uReveal * 1.18);
                vec4 text = texture2D(uMap, vUv);
                gl_FragColor = vec4(text.rgb, text.a * wipe * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    }),
);

/**
 * A thin peach ring on a soft dark shadow, drawn on round from the top (`uDraw`, 0 → 1; clockwise, or the other way with
 * `reverse`) with a brighter head while it's drawing, solid or dashed (`dashes` round it).
 */
const createContour = (inner: number, outer: number, { dashes = 0, reverse = false } = {}) => {
    const pad = RADIUS * 0.035;
    return new Mesh(
        new RingGeometry(inner - pad, outer + pad, 192, 1),
        new ShaderMaterial({
            uniforms: { uColor: { value: PEACH }, uDraw: { value: 0 }, uOpacity: { value: 0 } },
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
                    float shade = exp(-pow((r - ${((inner + outer) / 2).toFixed(5)}) / ${(pad * 0.5).toFixed(5)}, 2.0)) * 0.55;
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

/**
 * Belfast named on the way down: its name in the scene, inside a contour, hung over Belfast as the camera comes down so
 * it comes up to it and flies on through. It's kept square to the camera. Driven by `update`.
 */
export const createBelfastSign = () => {
    const nameSize = [RADIUS * 1.5, RADIUS * 0.4] as const;
    const name = createLine(createText(...nameSize, '600 200px Fraunces', (context) => {
        context.font = '600 200px Fraunces, Georgia, serif';
        context.fillText('Belfast', 512, 150);
    }), ...nameSize);
    const countrySize = [RADIUS * 1.2, RADIUS * 0.12] as const;
    const country = createLine(createText(...countrySize, '700 60px Satoshi', (context) => {
        context.font = '700 60px Satoshi, Helvetica, Arial, sans-serif';
        context.letterSpacing = '18px';
        context.fillText('NORTHERN IRELAND', 521, 52);
    }), ...countrySize);
    // Above the middle, so they read clear of Northern Ireland's outline, with Belfast in the middle of the contour
    const [nameY, countryY] = [RADIUS * 0.5, RADIUS * 0.22];
    const ring = createContour(RADIUS * 0.985, RADIUS);
    const outer = createContour(RADIUS * 1.16, RADIUS * 1.17, { dashes: 96, reverse: true });
    // A ripple out from the ring as it closes
    const ripple = createContour(RADIUS * 0.99, RADIUS);
    uniformsOf(ripple).uDraw.value = 1;
    const object = new Group();
    object.add(ripple, outer, ring, name, country);
    // In front of the cloud deck under it (which is drawn after the planet's clouds)
    object.children.forEach((child, i) => (child.renderOrder = 10 + i));
    object.visible = false;
    const toCamera = new Vector3();

    return {
        object,
        /**
         * Hangs the sign `distance` ahead of the camera towards `over` (Belfast, which the camera looks at on the way
         * down), facing the camera. `enter` (0 → 1) draws it on: the ring round, the dashed ring the other way after it,
         * a ripple as the ring closes, then the name wiped on and the country under it. `opacity` takes it away, and
         * close up the lettering goes first, the contours following as they sweep out past the edges of the screen.
         */
        update(camera: PerspectiveCamera, over: Vector3, distance: number, enter: number, opacity: number) {
            const near = distance / RADIUS;
            object.visible = enter > 0 && opacity > 0.001 && near > 0.05;
            if (!object.visible) return;
            toCamera.subVectors(over, camera.position).normalize();
            object.position.copy(camera.position).addScaledVector(toCamera, distance);
            object.quaternion.copy(camera.quaternion);

            const rings = opacity * smoothstep(clamp01((near - 0.15) / 0.6));
            uniformsOf(ring).uDraw.value = span(enter, 0, 0.5);
            uniformsOf(ring).uOpacity.value = rings * 0.95;
            uniformsOf(outer).uDraw.value = span(enter, 0.18, 0.7);
            uniformsOf(outer).uOpacity.value = rings * 0.55;
            const rippling = clamp01((enter - 0.46) / 0.32);
            ripple.scale.setScalar(1 + (1 - (1 - rippling) ** 3) * 0.45);
            uniformsOf(ripple).uOpacity.value = rippling > 0 && rippling < 1 ? rings * 0.6 * (1 - rippling) ** 2 : 0;

            const lettering = opacity * smoothstep(clamp01((near - 1) / 1.5));
            const named = span(enter, 0.45, 0.85);
            uniformsOf(name).uReveal.value = named;
            uniformsOf(name).uOpacity.value = lettering;
            name.position.y = nameY - (1 - named) * RADIUS * 0.06;
            const countried = span(enter, 0.68, 1);
            uniformsOf(country).uReveal.value = countried;
            uniformsOf(country).uOpacity.value = lettering * 0.9;
            country.position.y = countryY - (1 - countried) * RADIUS * 0.04;
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
