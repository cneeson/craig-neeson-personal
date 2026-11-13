import {
    HalfFloatType, Mesh, Object3D, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Vector2, Vector3,
    WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { isMobile } from '@/services/device';
import { clamp01, smoothstep } from '@/services/three';
import { photoUniforms } from './photo-materials';

/**
 * Up over City Hall, a coin-op telescope looks out to where it started: Ulster University in Coleraine, then
 * Nitec in Antrim. And for Ankorstore, binoculars on Paris: its office at Morning Auber by the Opéra, the Eiffel Tower behind. Far too far to see from Belfast, so each has a camera of its own, about a kilometre short of
 * it along the line of sight from City Hall, whose tiles load ahead like the flight's (see photo-city.ts). What
 * it sees is drawn into a texture and shown through the eyepieces, with the lens's distortion, colour fringes
 * and wobble, opening like an iris and whipping across from one to the other.
 */

interface Sight {
    /** What it looks at, in scene units (10 m), on the tiles' ground (it falls away with the earth's curve). */
    target: Vector3;
    /** The bearing from City Hall (degrees), so the view comes from the right side. */
    bearing: number;
    /** How far short of the target the camera stands, and how high above it (scene units). */
    standOff: number;
    height: number;
    /** Its field of view (degrees), on a landscape screen. */
    fov: number;
}

export type SightName = 'coleraine' | 'antrim' | 'ankorstore';

// The tiles are laid on a plane touching the earth at Belfast, so the ground drops away with distance
const SIGHTS: Record<'coleraine' | 'antrim', Sight> = {
    // Ulster University's Coleraine campus, about 78 km north-west. Outside the photorealistic tiles' coverage
    // (just terrain and aerial photos), so its buildings are outlined (offices.ts)
    coleraine: { target: new Vector3(-4855, -45.5, -6110), bearing: 321.5, standOff: 110, height: 35, fov: 26 },
    // Antrim Technology Park, where Nitec is (offices.ts), about 21 km north-west: from high enough to see it over
    // the trees
    antrim: { target: new Vector3(-1819.5, 0.3, -1098.7), bearing: 304.2, standOff: 100, height: 26, fov: 14 },
};


/** A place on the earth: degrees, and metres above the WGS84 ellipsoid (the tiles' datum). */
interface Place { lat: number, lon: number, height: number }
/** Converts a place to the scene (photo-city.ts `toScene`), with the way up there. */
export type ToScene = (place: Place, target: Vector3, up?: Vector3) => Vector3;

/**
 * Paris, some 860 km off: too far round the earth for the flat-plane sights above, so it's placed by latitude and
 * longitude. From about 700 m north-east of Ankorstore's office (the Morning Auber co-working space, 6 rue Auber) and
 * 65 m up, looking south-west past it to the Eiffel Tower, about 3 km beyond it (the ground's about 90 m above the
 * ellipsoid there).
 */
const PARIS = {
    office: { lat: 48.87231, lon: 2.32988, height: 115 },
    camera: { lat: 48.87556, lon: 2.33807, height: 155 },
    // Over the office, so it's above the card under the eyepieces and the tower's top is in frame
    look: { lat: 48.87231, lon: 2.32988, height: 161 },
    fov: 26,
};

const createSightCamera = ({ target, bearing, standOff, height, fov }: Sight) => {
    const camera = new PerspectiveCamera(fov, 1, 0.3, 1000);
    const radians = (bearing * Math.PI) / 180;
    // Back along the bearing, towards Belfast
    camera.position.set(target.x - Math.sin(radians) * standOff, target.y + height, target.z + Math.cos(radians) * standOff);
    camera.lookAt(target.x, target.y + 2, target.z);
    camera.updateMatrixWorld();
    return camera;
};

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        // Straight to the screen, whatever the camera
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uView;
    uniform float uOpen;
    uniform float uSwing;
    uniform float uTime;
    uniform float uAspect;
    uniform float uBinocular;
    uniform float uRadius;
    uniform float uGap;
    uniform vec2 uMark;
    varying vec2 vUv;

    // Distance outside the eyepieces (negative inside), and the radius of each
    float eyepieces(vec2 p, float radius, out vec2 centre) {
        // Up a little, leaving room for the card underneath
        if (uBinocular > 0.5) {
            centre = vec2(p.x < 0.0 ? -uGap : uGap, 0.08);
        } else {
            centre = vec2(0.0, 0.12);
        }
        return length(p - centre) - radius;
    }

    vec3 look(vec2 uv) {
        return texture2D(uView, clamp(uv, 0.0, 1.0)).rgb;
    }

    void main() {
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float radius = uRadius * mix(0.2, 1.0, uOpen);
        vec2 centre;
        float outside = eyepieces(p, radius, centre);

        // The lens bends the edges in, a little more red one way and blue the other
        vec2 fromCentre = (p - centre) / radius;
        float bend = dot(fromCentre, fromCentre);
        // Centred on the eyepieces
        vec2 q = vUv - 0.5 - vec2(0.0, centre.y);
        // Held by hand: a slow sway and a little shake
        q += vec2(sin(uTime * 0.9) + 0.4 * sin(uTime * 2.3), cos(uTime * 0.7) + 0.3 * sin(uTime * 3.1)) * 0.0025;
        q *= 1.0 - 0.07 * bend;
        // Whipping across: the view slides and smears sideways
        q.x += uSwing * 0.35;
        vec2 fringe = q * 0.012 * bend;
        // Out of focus as the iris opens
        float blur = abs(uSwing) * 0.06 + (1.0 - uOpen) * 0.012;
        vec3 color = vec3(0.0);
        for (int i = 0; i < 8; i++) {
            float k = (float(i) / 7.0 - 0.5);
            vec2 offset = vec2(k * blur * 2.0, k * (1.0 - uOpen) * 0.01);
            color.r += look(0.5 + q + fringe + offset).r;
            color.g += look(0.5 + q + offset).g;
            color.b += look(0.5 + q - fringe + offset).b;
        }
        color /= 8.0;
        // A touch more colour than the haze leaves it
        color = mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, 1.2);
        // Brackets round what it's looking at, through the same lens
        vec2 mark = abs((0.5 + q - uMark) * vec2(uAspect, 1.0));
        float box = 0.045 + 0.006 * sin(uTime * 3.0);
        float onBox = step(abs(max(mark.x, mark.y) - box), 0.0016);
        float inCorner = step(box * 0.55, min(mark.x, mark.y));
        color = mix(color, vec3(0.53, 0.72, 0.95) * 1.6, onBox * inCorner * (1.0 - abs(uSwing)));
        // Darker towards the rim of the lens
        color *= mix(1.0, 0.35, smoothstep(0.55, 1.0, sqrt(bend)));

        float edge = fwidth(outside) * 1.5;
        float inside = 1.0 - smoothstep(-edge, edge, outside);
        // A glint round the rim, and the dark housing round the eyepieces
        float rim = smoothstep(0.012, 0.0, abs(outside - 0.006)) * 0.18;
        vec3 housing = vec3(0.012, 0.01, 0.03) + rim;
        gl_FragColor = vec4(mix(housing, color, inside), mix(0.9 * uOpen, 1.0, inside * uOpen));
    }
`;

export const createTelescope = (renderer: WebGLRenderer) => {
    const paris = new PerspectiveCamera(PARIS.fov, 1, 0.3, 1000);
    const parisTarget = new Vector3();
    const cameras: Record<SightName, PerspectiveCamera> = {
        coleraine: createSightCamera(SIGHTS.coleraine), antrim: createSightCamera(SIGHTS.antrim), ankorstore: paris,
    };
    const targets: Record<SightName, Vector3> = {
        coleraine: SIGHTS.coleraine.target, antrim: SIGHTS.antrim.target, ankorstore: parisTarget,
    };
    const fovs: Record<SightName, number> = { coleraine: SIGHTS.coleraine.fov, antrim: SIGHTS.antrim.fov, ankorstore: PARIS.fov };
    const look = new Vector3();
    const renderTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
    const material = new ShaderMaterial({
        uniforms: {
            uView: { value: renderTarget.texture },
            uOpen: { value: 0 },
            uSwing: { value: 0 },
            uTime: { value: 0 },
            uAspect: { value: 1 },
            uBinocular: { value: 1 },
            uRadius: { value: 0.33 },
            uGap: { value: 0.24 },
            uMark: { value: new Vector2(0.5, 0.5) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const overlay = new Mesh(new PlaneGeometry(2, 2), material);
    overlay.frustumCulled = false;
    overlay.renderOrder = 1000;
    overlay.visible = false;

    const size = new Vector2();
    const resolution = new Vector2();
    const skyPosition = new Vector3();
    const mark = new Vector3();

    return {
        overlay,
        /** Every sight's camera, for the tiles to load for. */
        cameras: Object.values(cameras),
        /**
         * Puts the Paris camera in place, with `toScene` (the tiles' own frame, once they're set up), upright there
         * rather than as Belfast's up.
         */
        locate(toScene: ToScene) {
            toScene(PARIS.camera, paris.position, paris.up);
            toScene(PARIS.office, parisTarget);
            paris.lookAt(toScene(PARIS.look, look));
            paris.updateMatrixWorld();
        },
        /**
         * The cameras to load for, by the sights about to be looked through. Mostly one at a time, as two (on top
         * of the reader's wide view over City Hall) can fill the cache.
         */
        camerasFor(sights: SightName[]) {
            return sights.map(sight => cameras[sight]);
        },
        /** The CSS size the tiles should pick detail for, as seen through it. */
        resolution,

        /**
         * Every frame in the city, with how far it's `open` (0 → 1), the `sight` it shows and the `whip` across from
         * one to the other (-1 → 1, the cut at 0). Draws what that sight's camera sees (`sky` follows it, `world` is
         * what's drawn).
         */
        update(
            { open, sight: sightName, whip }: { open: number, sight: SightName, whip: number },
            elapsed: number, aspect: number, sky: Object3D, world: Object3D[],
        ) {
            overlay.visible = open > 0.001;
            // Sized to the screen in CSS pixels whether or not it's up, for the tiles
            renderer.getSize(resolution);
            if (!overlay.visible) return;

            const isSwinging = Math.abs(whip) < 1;
            const camera = cameras[sightName];
            const isBinoculars = sightName === 'ankorstore';

            const isPortrait = aspect < 1;
            // Wider on narrow screens, so what it's looking at fits across
            const fov = isPortrait ? fovs[sightName] * 1.5 : fovs[sightName];
            if (camera.aspect !== aspect || camera.fov !== fov) {
                [camera.aspect, camera.fov] = [aspect, fov];
                camera.updateProjectionMatrix();
            }

            renderer.getDrawingBufferSize(size);
            const scale = isMobile ? 0.6 : 0.8;
            const [width, height] = [Math.round(size.x * scale), Math.round(size.y * scale)];
            if (renderTarget.width !== width || renderTarget.height !== height) renderTarget.setSize(width, height);

            // Less haze: it's a clear day through the lens
            const fogDensity = photoUniforms.uFogDensity.value;
            photoUniforms.uFogDensity.value = fogDensity * 0.45;
            skyPosition.copy(sky.position);
            sky.position.copy(camera.position);
            sky.updateMatrixWorld();

            const [previousTarget, autoClear] = [renderer.getRenderTarget(), renderer.autoClear];
            renderer.setRenderTarget(renderTarget);
            renderer.autoClear = false;
            renderer.clear();
            renderer.render(sky, camera);
            world.forEach(object => renderer.render(object, camera));
            renderer.setRenderTarget(previousTarget);
            renderer.autoClear = autoClear;

            sky.position.copy(skyPosition);
            sky.updateMatrixWorld();
            photoUniforms.uFogDensity.value = fogDensity;

            const { uniforms } = material;
            uniforms.uOpen.value = smoothstep(clamp01(open));
            // Rising to 1 at the cut, then back from -1 (the new view arriving from the other side)
            uniforms.uSwing.value = isSwinging ? (whip < 0 ? 1 + whip : whip - 1) : 0;
            uniforms.uTime.value = elapsed;
            uniforms.uAspect.value = aspect;
            // The telescope's twin eyepieces on wide screens, and one on narrow ones; the binoculars always two,
            // drawn closer together to fit across a phone
            const isTwin = isBinoculars || !isPortrait;
            uniforms.uBinocular.value = isTwin ? 1 : 0;
            uniforms.uRadius.value = isTwin && isPortrait ? aspect * 0.32 : isTwin ? 0.33 : Math.min(aspect * 0.46, 0.36);
            uniforms.uGap.value = isTwin && isPortrait ? aspect * 0.32 * 0.58 : 0.24;
            mark.copy(targets[sightName]).project(camera);
            uniforms.uMark.value.set((mark.x + 1) / 2, (mark.y + 1) / 2);
        },

        dispose() {
            renderTarget.dispose();
            material.dispose();
            overlay.geometry.dispose();
        },
    };
};
