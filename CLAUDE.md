# craig-neeson-personal

Craig Neeson's personal site: a single page built around a scroll-driven 3D planet scene, followed
by plain content sections (skills, experience, contact). Live at https://craigneeson.co.uk.

## Stack

- Vue 3 (`<script setup>`, TypeScript) on **Vue CLI 5 / webpack**, not Vite
- TresJS 4 (`@tresjs/core`, `@tresjs/cientos`, `@tresjs/post-processing`) over three.js
- GSAP 3 with ScrollTrigger and ScrollSmoother (bundled in the public `gsap` package)
- Tailwind 3 plus scoped SCSS (Dart Sass)

## Commands

```sh
npm install
npm run serve      # dev server (http://localhost:8080)
npm run lint       # eslint --fix; use `npx vue-cli-service lint --no-fix` to check only
npm run build      # production build into dist/
npm run belfast    # rebuild public/belfast/ from OpenStreetMap (Overpass); add --refresh to re-download
```

There are no tests. Verify changes by running the site and looking at it (see Verifying).

## Google 3D Tiles key

The day city needs `VUE_APP_GOOGLE_MAPS_API_KEY` (Map Tiles API). Locally it goes in `.env.local`
(gitignored, never commit it); CI reads the `GOOGLE_MAPS_API_KEY` repo secret. Without it the night city is used.
Each visit that reaches the city starts a billable root-tileset session.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which lints, builds and publishes `dist/` to
GitHub Pages (source: GitHub Actions). PRs run the lint and build only. The custom domain comes
from `public/CNAME`. Nothing is built into the repo: `docs/` is legacy output and is gitignored.

## Layout

- `src/App.vue`: page shell. Sets up the fixed `.scene` canvas, the captions, the journey nav, and all
  GSAP/ScrollTrigger timelines (the journey across `.scene-track`, settling onto captions, the hand-off
  blur as `.content` arrives, and section reveals).
- `src/components/PlanetScene.vue`: the Tres scene (earth, clouds, stars, markers, bloom) and the
  render loop. Must stay inside `<Suspense>` because it awaits textures.
- `src/components/belfast-photo.vue`: the Belfast flythrough by day, from Google Photorealistic 3D Tiles
  (`src/scene/belfast/photo-city.ts`, via `3d-tiles-renderer`). Mounted 1.5s after the planet. Extra cameras
  along the flight (`setCamera`) load it ahead of the reader: the start of the flight first (then it's drawn
  off screen to warm the GPU and `sceneState.cityReady` is set), then a prefetch camera walks the rest. The
  whole flight doesn't fit in the tile cache, so evicted tiles come back from the browser's HTTP cache. Keep the
  views few and the cache well above what they need: once it's full, tiles the reader's view needs are refused
  and the city flickers between levels of detail. The tile shader is swapped in by a plugin (`processTileModel`)
  so `TilesFadePlugin` can cross-fade levels; it needs `#include <dithering_fragment>` in that shader. Google's
  terms forbid hosting or bundling the tiles: only load them in the browser, in the same visit. Their
  attribution (logo + data providers) must stay visible while they're on screen (`city-attribution.vue`).
- `src/components/belfast-city.vue`: the night-time Belfast from OpenStreetMap, the fallback when the tiles
  can't be used (no key, Save-Data, the root tileset fails, or nothing loads in time; `?city=night` forces it).
  `src/scene/belfast/mode.ts` holds the choice. Decoded in `src/scene/belfast/city.worker.ts`, then drawn once
  off screen to warm up the GPU. Sets `sceneState.cityReady`.
- `src/components/cloud-veil.vue`: full-screen cloud layer hiding the planet ↔ city switch (`veilAt`). It holds,
  then fades, if the city hasn't loaded by the time the reader gets there.
- `src/components/planet-hud.vue`: DOM overlays pinned to the planet (the forecast, the lock-on to Belfast, the
  labels where the reach arcs land). Positioned every frame through `onOverlayFrame` (`src/scene/overlay.ts`), which
  the render loop calls with the camera; shown and hidden in time by class.
- `src/scene/planet/`: the effects on the planet. `clouds.ts` patches the cloud layer to gather over Northern Ireland
  and part over it (the centre must be turned into the cloud mesh's spinning space); `highlight.ts` traces the
  outline (`northern-ireland.ts`, from Natural Earth) and scans the land; `arcs.ts` draws the arcs to the HQs.
  `geo.ts` converts lat/lon to the earth group's space (`onEarth`) and holds `EARTH_POSITION`.
- `src/scene/choreography.ts`: **the whole journey is a pure function of scroll progress (0..1)**.
  It holds:
  - the beat `windows` (where each caption is fully readable; captions in App.vue are named after them with
    `data-caption`, and neighbouring text beats need a gap of at least 0.012 so they don't overlap);
  - camera/earth keyframes, with optional portrait overrides, joined by monotone cubic splines so the
    camera never stops dead or reverses between keyframes;
  - `settleAt` (easing onto a nearby caption when scrolling stops);
  - the nav `chapters`;
  - the dive into Belfast (`diveAt`, `veilAt`, `isInBelfast`, `flightProgressAt`).

  Tune the motion here. Keep keyframes on the window edges so the camera arrives as the caption does.
- `src/scene/captions.ts`: word-by-word caption entrances. They play in time rather than being
  scrubbed, so a caption always finishes revealing.
- `src/components/journey-nav.vue`: the chapter rail on the right (md and up).
- `src/scene/state.ts`: plain mutable `{ progress, exit }`, written by GSAP and read every frame by
  the render loop. Deliberately not reactive.
- `src/scene/camera.ts`: the camera instance handed to `<TresCanvas>` (see gotchas).
- `src/services/device.ts`: mobile detection (`pointer: coarse`) and the quality tiers (DPR cap,
  textures, star counts, blur).
- `src/scene/belfast/`: the city. `geo.ts` (origin and bounds; must match the build script),
  `flight.ts` (flown backwards, looking back along the path as it turns: out of the clouds just short of the H&W
  cranes and under them, over the SSE Arena, across the Lagan by the M3 and Dargan (rail) bridges, over the weir
  and the city centre. Place waypoints from the tiles, not OSM: the cranes move along their dock). The glide from
  orbit (`approachAt` in choreography, `glideFromOrbit` in PlanetScene) starts far north looking on past the pole,
  backs south past Northern Ireland still looking north, and sinks onto it, turning to the flight's starting
  heading; it runs along a great circle that passes beside the pole, as the planet's texture pinches at it. The
  climb out carries on along the flight's end heading (`climbFromHome`, `FLIGHT_ENDS`). `water.ts`, `starlings.ts`
  and `train.ts` animate the day city; the train is moved by the scroll so it always crosses the Dargan Bridge just
  after the reader passes over it, `photo-materials.ts` (tile shader with haze, day sky), `materials.ts` (night shaders), `landmarks.ts` (hand-built cranes,
  Titanic Belfast, City Hall), `roads.ts` (road texture, drawn in the worker via OffscreenCanvas when possible).
- `scripts/belfast/build.mjs` → `public/belfast/city.bin` (buildings + roads, binary layout in the script header)
  and `ground.png` (water/park mask). Landmarks that are hand-built are excluded by OSM id. The data is
  © OpenStreetMap contributors (credited in the attributions dialog); keep that credit.
- `src/data/jobs.ts`: experience content. Other copy lives in the `src/views/*` components.
- `public/textures/earth/` (desktop) and `public/textures/earth/low-res/` (mobile).

## Gotchas (each of these cost real debugging time)

- **Don't name components `Tres<Something>` where `Something` is a three.js export.** `vue.config.js`
  treats those tags as Tres custom elements. `TresScene` once rendered a blank canvas (it matched
  `THREE.Scene`); that's why the scene component is called `PlanetScene`.
- **The camera is created up front and passed to `<TresCanvas :camera>`.** If it's declared inside the
  async scene, Tres first creates a default camera and then swaps it out. `EffectComposerPmndrs`
  rebuilds on that swap but its effects don't re-attach, so bloom silently disappears, depending on load timing.
- **cientos `<Outline>` starts with a 1×1 size uniform** and only updates on later resizes. On slow
  loads the rim covers the whole screen and hides the stars. `PlanetScene` seeds the size once
  (`sizeOutline`). Keep that if you touch the outline.
- **Bugs that depend on load timing don't show up on localhost.** Test with throttled or intercepted
  requests (e.g. Playwright `page.route`) or against the live site before calling a scene fix done.
- `useTexture` only accepts its fixed keys (`map`, `displacementMap`, `alphaMap`, ...). Other keys
  return nothing, so the bump map travels as `displacementMap` and the clouds as `alphaMap`.
- In `<script setup>` with top-level `await`, call `defineExpose` (and anything the parent needs
  immediately) **before** the first await.
- Rendering is `render-mode="on-demand"`. The loop calls `invalidate()` every frame while the scene is
  visible, and stops once `sceneState.exit >= 1` (the scene is hidden behind the content).
- **Don't use ScrollTrigger's `snap` (or its `scrollEnd` event) for the journey.** With ScrollSmoother
  running, `snap` stops the smoothed content following any jump upwards (Home key, nav clicks), and
  `scrollEnd` doesn't always fire once smoothing finishes. Settling is a `delayedCall` that the
  journey trigger restarts on every update. It skips while a touch is down.
- The captions are rendered `v-once` because `createCaption` splits their text into word spans. A Vue
  re-render would fight that.
- The stars are tiny and rely on bloom to be visible. If they vanish, check the composer first.
- City scale is 1 unit = 10 m, at the world origin. The planet group is hidden while in the city (and vice versa),
  and the camera's fov/near change on the switch (`setLens`), which happens under full cloud cover.
- City shaders output linear colour (write constants via `lin()`) and derive flat normals from screen-space
  derivatives, so building vertices are shared. Windows fade to their average once smaller than a pixel or
  two; keep that or the facades shimmer.
- ScrollSmoother is desktop only. Touch devices use native scrolling, and the scene is sized in
  `100lvh` so mobile address-bar changes don't resize the canvas.

## Verifying visually

Run the site (or `npm run build` and serve `dist/`) and screenshot several scroll positions with
headless Chrome via Playwright, at desktop size (e.g. 1440×900) and at a phone size with touch and
coarse pointer (e.g. 390×844). Use real GPU flags (`--use-angle=metal --ignore-gpu-blocklist` on macOS)
or WebGL falls back to software. Check at least: the hero, the Northern Ireland marker, the dive into the clouds, the
Belfast flight (the intro caption, under both cranes, City Hall), all five Europe markers in frame (portrait is the tight
case), the planet reveal, and the content hand-off. Settling moves the scroll after it stops, so dispatch a
`touchstart` on window first to capture exact positions. Also test a delayed `city.bin` (`page.route`).
