import {
    BufferAttribute, Group, InterleavedBufferAttribute, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Texture,
    Vector2, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import { GLTFExtensionsPlugin, ReorientationPlugin, TilesFadePlugin } from '3d-tiles-renderer/plugins';
import { isMobile } from '@/services/device';
import { ORIGIN, UNIT } from './geo';
import { placeCamera, type Pose } from '@/scene/shots';
import { createTileMaterial } from './photo-materials';

/** Height of the ground at ORIGIN above the ellipsoid (the tiles' datum), so street level sits at y = 0. */
const GROUND_HEIGHT = 58;

const MEGABYTE = 2 ** 20;

// Phones keep less in memory (iOS kills tabs that use too much). The error's in CSS pixels, and a phone's screen has
// a quarter of a desktop's, so even a slightly tighter target asks for well under half the tiles (a looser one left
// the city lumpy, on screens that are close to the eye). Low over the city the
// reader's view plus one view ahead take most of the cache; more views than that and the cache fills, the
// reader's view gets refused the detail it needs, and the city flickers between levels of detail.
const settings = isMobile
    ? { errorTarget: 16, minBytes: 200 * MEGABYTE, maxBytes: 320 * MEGABYTE }
    : { errorTarget: 20, minBytes: 450 * MEGABYTE, maxBytes: 700 * MEGABYTE };

/**
 * Lets go of a tile's copy in memory once it's on the GPU: its vertices once they're uploaded, and its photo
 * (decoded, it's far bigger than the download) once that is. Otherwise every tile in the cache is held twice,
 * and the tab carries the whole cache on top of the GPU's. Nothing reads them back (the city isn't raycast).
 * Bounds are worked out first, as three needs the vertices for them. Returns the bytes of the photo let go of,
 * which the cache then can't measure for itself.
 */
const freeOnUpload = (mesh: Mesh): number => {
    const { geometry } = mesh;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    // The vertices go once uploaded, at the tile's first draw, after the cache has counted them
    [...Object.values(geometry.attributes), geometry.index].forEach(attribute => {
        if (attribute && !(attribute as InterleavedBufferAttribute).isInterleavedBufferAttribute) {
            (attribute as BufferAttribute).onUpload(function (this: BufferAttribute) {
                (this as { array: unknown }).array = null;
            });
        }
    });
    const map = (mesh.material as { photo?: Texture }).photo;
    if (!map || !(map.image instanceof ImageBitmap)) return 0;
    const { width, height } = map.image;
    map.onUpdate = () => (map.image as ImageBitmap).close();
    // RGBA, plus its mipmaps
    return width * height * 4 * (map.generateMipmaps ? 4 / 3 : 1);
};

/** At most this many views ahead of the reader at once. */
const AHEAD_VIEWS = 2;

/** Frames with nothing left to load before the views count as loaded. */
const SETTLE_FRAMES = 10;

/**
 * Seconds the reader waits in the clouds (on a slow connection, told so by city-loading.vue) before the city shows
 * whatever has loaded so far, or, if nothing has, gives up (and the clouds stay). Long enough that it rarely clears
 * onto a city still only in its coarsest tiles.
 */
const MAX_WAIT = { partial: 15, nothing: 20 };

/**
 * Belfast from Google's photorealistic 3D tiles. The tiles renderer loads whatever its cameras need, so
 * extra cameras placed at the director's shots (shots.ts) load it ahead of the reader:
 *
 * - Views ahead cover where the reader's going: where the glide from orbit comes out of the clouds while
 *   they're still on the planet, then the end of each move as the camera flies there. Once the first have
 *   loaded, they're drawn off screen to upload them to the GPU and the city is `isReady`.
 * - Then, while the camera's held at a stop, a prefetch view visits the other shots, one at a time. All of
 *   them decoded is far more than fits in memory, so older tiles are dropped as it goes, but their downloads
 *   stay in the browser's cache (Google allows four hours), so they decode again quickly when they're needed.
 * - `extraViews` (the telescope's, looking out of the city) are visited last by the prefetch, then load
 *   again while the reader is near them (`update`'s `activeViews`).
 */
export const createPhotoCity = (
    renderer: WebGLRenderer,
    apiKey: string,
    onFail: (error: unknown) => void,
    extraViews: { cameras: PerspectiveCamera[], resolution: Vector2 } = { cameras: [], resolution: new Vector2() },
) => {
    const tiles = new TilesRenderer();
    // Swaps in the tile shader as each tile is parsed, before the fade plugin (below) prepares its materials
    // The photos' bytes, freed (so unmeasurable) by the time the cache counts each tile
    const photoBytes = new WeakMap<Group, number>();
    tiles.registerPlugin({
        name: 'TILE_MATERIAL_PLUGIN',
        processTileModel(scene: Group) {
            let bytes = 0;
            scene.traverse(object => {
                const mesh = object as Mesh;
                if (!mesh.isMesh) return;
                const original = mesh.material as MeshBasicMaterial;
                const material = createTileMaterial(original.map);
                // The tiles renderer finds a tile's textures among its materials' properties, not in shader
                // uniforms: kept here too, it frees the photo when the tile goes (it's counted against the
                // cache by `calculateBytesUsed`). Otherwise none of them are ever freed, and the GPU fills
                // until the city turns dark
                if (original.map) Object.assign(material, { photo: original.map });
                mesh.material = material;
                original.dispose();
                bytes += freeOnUpload(mesh);
                // Uploaded now, while loading in the background, rather than on the frame it first appears
                if (original.map) renderer.initTexture(original.map);
            });
            photoBytes.set(scene, bytes);
        },
        calculateBytesUsed(tile: unknown, scene: Group | null) {
            return scene ? photoBytes.get(scene) ?? 0 : 0;
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

    let hasFailed = false;
    const fail = (error: unknown) => {
        if (hasFailed) return;
        hasFailed = true;
        onFail(error);
    };
    // Each tile keeps its whole glTF as metadata, the parser and its download included, while only its copyright
    // (for the attribution) is read from it
    tiles.addEventListener('load-model', ({ tile }: { tile: { engineData: { metadata?: { asset?: unknown } | null } } }) => {
        const { engineData } = tile;
        if (engineData.metadata) engineData.metadata = { asset: engineData.metadata.asset };
    });
    // The root tileset failing (a bad key, or over quota) means nothing will load
    tiles.addEventListener('load-error', ({ tile, error }) => {
        if (!tile) fail(error);
    });
    const timeout = setTimeout(() => {
        if (!tiles.root) fail(new Error('Timed out loading the tileset'));
    }, 20000);

    const resolution = new Vector2();
    const createView = () => new PerspectiveCamera(50, 1, 0.3, 1000);
    /** Puts a view at `pose`, with the real camera's lens, and has the tiles load for it. */
    const useView = (view: PerspectiveCamera, pose: Pose, aspect: number) => {
        placeCamera(view, pose, aspect);
        view.updateMatrixWorld();
        tiles.setCamera(view);
        tiles.setResolution(view, resolution);
    };

    const aheadViews = Array.from({ length: AHEAD_VIEWS }, createView);
    const prefetchView = createView();
    let prefetchStep = 0;
    let aheadCount = 0;

    let isReady = false;
    let settledFrames = 0;
    let waited = 0;

    /** Draws what the views ahead see into a tiny target, uploading it all to the GPU. */
    const warmUp = (count: number) => {
        const renderTarget = new WebGLRenderTarget(16, 16);
        const previous = renderer.getRenderTarget();
        renderer.setRenderTarget(renderTarget);
        aheadViews.slice(0, count).forEach(view => renderer.render(group, view));
        renderer.setRenderTarget(previous);
        renderTarget.dispose();
    };

    return {
        group,
        get isReady() {
            return isReady;
        },

        /**
         * Every frame. `isInCity` is whether the reader's looking at it, `ahead` the shots to load before they get
         * there, `prefetch` the shots to visit in the background while the camera's held still (`isMoving` false),
         * and `activeViews` the extra views to load for.
         */
        update(
            camera: PerspectiveCamera, isInCity: boolean, delta: number,
            { ahead, prefetch, isMoving, activeViews = [] }: { ahead: Pose[], prefetch: Pose[], isMoving: boolean, activeViews?: PerspectiveCamera[] },
        ) {
            if (hasFailed) return;
            group.updateMatrixWorld();
            // Detail is chosen for the screen's size in CSS pixels, however sharp the display
            renderer.getSize(resolution);
            aheadCount = Math.min(ahead.length, AHEAD_VIEWS);

            aheadViews.forEach((view, i) => {
                if (ahead[i]) useView(view, ahead[i], camera.aspect);
                else tiles.deleteCamera(view);
            });
            if (isInCity) {
                camera.updateMatrixWorld();
                tiles.setCamera(camera);
                tiles.setResolution(camera, resolution);
            } else {
                tiles.deleteCamera(camera);
            }
            // Fetching the rest waits until the start is ready, and gives way to the camera moving
            const steps = prefetch.length + extraViews.cameras.length;
            const isPrefetching = isReady && !isMoving && prefetchStep < steps;
            if (isPrefetching && prefetchStep < prefetch.length) useView(prefetchView, prefetch[prefetchStep], camera.aspect);
            else tiles.deleteCamera(prefetchView);
            const prefetchingView = isPrefetching ? extraViews.cameras[prefetchStep - prefetch.length] : undefined;
            extraViews.cameras.forEach(view => {
                if (view !== prefetchingView && !activeViews.includes(view)) {
                    tiles.deleteCamera(view);
                    return;
                }
                if (prefetchingView === view && view.aspect !== camera.aspect) {
                    view.aspect = camera.aspect;
                    view.updateProjectionMatrix();
                }
                tiles.setCamera(view);
                tiles.setResolution(view, extraViews.resolution.lengthSq() ? extraViews.resolution : resolution);
            });

            // Nothing to load for (out over the planet, with nothing ahead)
            if (!tiles.cameras.length) return;
            tiles.update();

            const hasTiles = tiles.visibleTiles.size > 0;
            if (!isReady && isInCity) {
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
                warmUp(aheadCount);
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
