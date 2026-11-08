import {
    Group, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, ShaderMaterial, Vector2, Vector3,
    WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { GLTFExtensionsPlugin, ReorientationPlugin, TilesFadePlugin } from '3d-tiles-renderer/plugins';
import { isMobile } from '@/services/device';
import { clamp01 } from '@/services/three';
import { ORIGIN, UNIT } from './geo';
import { cityFovAt, flightAt } from './flight';
import { createTileMaterial } from './photo-materials';

/** Height of the ground at ORIGIN above the ellipsoid (the tiles' datum), so street level sits at y = 0. */
const GROUND_HEIGHT = 58;

const MEGABYTE = 2 ** 20;

// Phones load coarser tiles and keep less in memory (iOS kills tabs that use too much). Low over the city the
// reader's view plus one lookahead view take most of the cache; more views than that and the cache fills, the
// reader's view gets refused the detail it needs, and the city flickers between levels of detail.
const settings = isMobile
    ? { errorTarget: 32, lookahead: [0, 0.06], minBytes: 150 * MEGABYTE, maxBytes: 240 * MEGABYTE }
    : { errorTarget: 20, lookahead: [0, 0.05], minBytes: 450 * MEGABYTE, maxBytes: 700 * MEGABYTE };

/** How many points along the flight are visited to fetch its tiles in the background. */
const PREFETCH_STEPS = 16;

/** Frames with nothing left to load before the views count as loaded. */
const SETTLE_FRAMES = 10;

/**
 * Seconds the reader waits in the clouds (on a slow connection) before the city shows whatever has
 * loaded so far, or, if nothing has, gives way to the night city.
 */
const MAX_WAIT = { partial: 6, nothing: 12 };

/**
 * Belfast from Google's photorealistic 3D tiles. The tiles renderer loads whatever its cameras need, so
 * extra cameras placed along the flight load it ahead of the reader:
 *
 * - Lookahead views cover the next stretch of the flight: its start (or end, coming back) while the
 *   reader is on the planet, then just ahead of them as they fly. Once the start has loaded, it's drawn
 *   off screen to upload it to the GPU and the city is `isReady`.
 * - Then a prefetch view walks the rest of the flight, one point at a time. The whole flight decoded
 *   is far more than fits in memory, so older tiles are dropped as it goes, but their downloads stay in
 *   the browser's cache (Google allows four hours), so the lookahead decodes them again quickly.
 */
export const createPhotoCity = (renderer: WebGLRenderer, apiKey: string, onFail: (error: unknown) => void) => {
    const tiles = new TilesRenderer();
    // Swaps in the tile shader as each tile is parsed, before the fade plugin (below) prepares its materials
    tiles.registerPlugin({
        name: 'TILE_MATERIAL_PLUGIN',
        processTileModel(scene: Group) {
            scene.traverse(object => {
                const mesh = object as Mesh;
                if (!mesh.isMesh) return;
                const original = mesh.material as MeshBasicMaterial;
                mesh.material = createTileMaterial(original.map);
                original.dispose();
                // Uploaded now, while loading in the background, rather than on the frame it first appears
                if (original.map) renderer.initTexture(original.map);
            });
        },
    });
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }));
    tiles.registerPlugin(new GLTFExtensionsPlugin({
        dracoLoader: new DRACOLoader().setDecoderPath(`${process.env.BASE_URL}draco/`),
    }));
    tiles.registerPlugin(new ReorientationPlugin({
        lat: MathUtils.degToRad(ORIGIN.lat),
        lon: MathUtils.degToRad(ORIGIN.lon),
        height: GROUND_HEIGHT,
    }));
    // Cross-fades between levels of detail rather than popping
    tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 400 }));
    // Set after registering, as the auth plugin applies its own defaults
    tiles.errorTarget = settings.errorTarget;
    tiles.lruCache.minBytesSize = settings.minBytes;
    tiles.lruCache.maxBytesSize = settings.maxBytes;

    // The plugin puts the tiles at the origin with x west and z north, in metres. The scene has x east,
    // z south, and works in units of 10 m.
    const group = new Group();
    group.rotation.y = Math.PI;
    group.scale.setScalar(1 / UNIT);
    group.add(tiles.group);

    // The renderer disposes of the tile shaders, but doesn't know about the photos in their uniforms
    tiles.addEventListener('dispose-model', ({ scene }) => {
        scene.traverse(object => {
            const mesh = object as Mesh;
            if (mesh.isMesh) (mesh.material as ShaderMaterial).uniforms.map?.value.dispose();
        });
    });

    let hasFailed = false;
    const fail = (error: unknown) => {
        if (hasFailed) return;
        hasFailed = true;
        onFail(error);
    };
    // The root tileset failing (a bad key, or over quota) means nothing will load
    tiles.addEventListener('load-error', ({ tile, error }) => {
        if (!tile) fail(error);
    });
    const timeout = setTimeout(() => {
        if (!tiles.root) fail(new Error('Timed out loading the tileset'));
    }, 20000);

    const target = new Vector3();
    const resolution = new Vector2();
    const createView = () => new PerspectiveCamera(50, 1, 0.3, 1000);
    /** Points a view along the flight at `t`, with the real camera's lens, and has the tiles load for it. */
    const useView = (view: PerspectiveCamera, t: number, aspect: number) => {
        const fov = cityFovAt(t, aspect);
        if (view.aspect !== aspect || view.fov !== fov) {
            [view.aspect, view.fov] = [aspect, fov];
            view.updateProjectionMatrix();
        }
        flightAt(t, view.position, target);
        view.lookAt(target);
        view.updateMatrixWorld();
        tiles.setCamera(view);
        tiles.setResolution(view, resolution);
    };

    const lookaheadViews = settings.lookahead.map(createView);
    const prefetchView = createView();
    let prefetchStep = 0;

    let isReady = false;
    let settledFrames = 0;
    let waited = 0;

    /** Draws what the lookahead views see into a tiny target, uploading it all to the GPU. */
    const warmUp = () => {
        const renderTarget = new WebGLRenderTarget(16, 16);
        const previous = renderer.getRenderTarget();
        renderer.setRenderTarget(renderTarget);
        lookaheadViews.forEach(view => renderer.render(group, view));
        renderer.setRenderTarget(previous);
        renderTarget.dispose();
    };

    return {
        group,
        get isReady() {
            return isReady;
        },

        /**
         * Every frame. `flight` is how far along the flight the reader is (0 before it, 1 after it), and
         * `direction` which way they're heading through it.
         */
        update(camera: PerspectiveCamera, isFlying: boolean, flight: number, direction: number, delta: number) {
            if (hasFailed) return;
            group.updateMatrixWorld();
            // Detail is chosen for the screen's size in CSS pixels, however sharp the display
            renderer.getSize(resolution);

            lookaheadViews.forEach((view, i) => {
                const offset = settings.lookahead[i];
                // While flying, the reader's own view covers where they are
                if (isFlying && offset === 0) tiles.deleteCamera(view);
                else useView(view, clamp01(flight + offset * direction), camera.aspect);
            });
            if (isFlying) {
                camera.updateMatrixWorld();
                tiles.setCamera(camera);
                tiles.setResolution(camera, resolution);
            } else {
                tiles.deleteCamera(camera);
            }
            // Fetching the rest of the flight waits until the start is ready, and gives way to the reader flying
            const isPrefetching = isReady && !isFlying && prefetchStep < PREFETCH_STEPS;
            if (isPrefetching) useView(prefetchView, prefetchStep / (PREFETCH_STEPS - 1), camera.aspect);
            else tiles.deleteCamera(prefetchView);

            tiles.update();

            const hasTiles = tiles.visibleTiles.size > 0;
            if (!isReady && isFlying) {
                waited += delta;
                if (waited > MAX_WAIT.nothing && !hasTiles) fail(new Error('Nothing loaded in time'));
                if (waited > MAX_WAIT.partial && hasTiles) isReady = true;
            }

            const isSettled = !!tiles.root && hasTiles && tiles.loadProgress >= 1;
            settledFrames = isSettled ? settledFrames + 1 : 0;
            if (settledFrames < SETTLE_FRAMES) return;
            settledFrames = 0;
            if (!isReady) {
                clearTimeout(timeout);
                warmUp();
                isReady = true;
            } else if (isPrefetching) {
                prefetchStep++;
            }
        },

        /** The data providers to credit for the tiles in view. */
        attributions: () => tiles.getAttributions()
            .filter(item => item.type === 'string')
            .map(item => item.value as string)
            .join('; '),

        dispose() {
            clearTimeout(timeout);
            tiles.dispose();
        },
    };
};
