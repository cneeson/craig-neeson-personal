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
npm run belfast    # rebuild public/belfast/water.png from OpenStreetMap (Overpass); add --refresh to re-download
```

There are no tests. Verify changes by running the site and looking at it (see Verifying).

## Google 3D Tiles key

The city needs `VUE_APP_GOOGLE_MAPS_API_KEY` (Map Tiles API). Locally it goes in `.env.local`
(gitignored, never commit it); CI reads the `GOOGLE_MAPS_API_KEY` repo secret. There's no fallback city: without a
key, or if the tiles fail, the city isn't mounted and the flight stays in the clouds.
Each visit that reaches the city starts a billable root-tileset session.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which lints, builds and publishes `dist/` to
GitHub Pages (source: GitHub Actions). PRs run the lint and build only. The custom domain comes
from `public/CNAME`. Nothing is built into the repo: `docs/` is legacy output and is gitignored.

## Layout

- `src/App.vue`: page shell. Sets up the fixed `.scene` canvas, the captions, the journey nav, and all
  GSAP/ScrollTrigger timelines (the journey across `.scene-track`, settling onto captions, the hand-off
  blur as `.content` arrives, and section reveals).
- `src/components/PlanetScene.vue`: the Tres scene (earth, clouds, atmosphere, stars, markers, bloom + SMAA) and
  the render loop. Must stay inside `<Suspense>` because it awaits textures.
- `src/scene/earth.ts`: the earth's material (the day map plus NASA Black Marble city lights where the scene's sun
  doesn't reach, coming on through dusk, and a haze towards the disc's edge) and the atmosphere shell, which glows
  by how close each line of sight passes to the ground, so it works from orbit and from just above the clouds.
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
- `src/components/cloud-veil.vue`: full-screen cloud layer hiding the planet ↔ city switch (`veilAt`). It holds,
  then fades, if the city hasn't loaded by the time the reader gets there.
- `src/components/planet-hud.vue`: DOM overlays pinned to the planet (the forecast, the lock-on to Belfast, the
  labels where the reach arcs land). Positioned every frame through `onOverlayFrame` (`src/scene/overlay.ts`), which
  the render loop calls with the camera; shown and hidden in time by class.
- `src/components/city-signs.vue`: the text over Belfast. The skills gig poster stands by the SSE Arena (a CSS3DRenderer
  following the city camera, turned to face it); each employer gets a callout flat to the screen, with a dot on its
  building and a leader up to a card kept inside the viewport (in the sky instead if the building's out of view, as on
  narrow screens, and always for Ankorstore). The cards' buttons open `employer-dialog.vue` with the role's key points
  from `src/data/journey.ts` (the stops) and `jobs.ts`. Only the buttons take the pointer, so the page still scrolls.
- `src/scene/belfast/offices.ts`: the employers' buildings (OSM footprints, rough heights), outlined in light while
  their beat is up, and the callouts' anchors. Frame each beat's camera on its building in `flight.ts`.
  `paris-arc.ts` draws the arc from Ormeau Business Park in the Gasworks towards Paris for Ankorstore.
- `src/scene/belfast/telescope.ts`: the coin-op telescope over City Hall. A camera of its own about a
  kilometre short of each place (Coleraine, then Antrim) renders into a texture, shown through the eyepieces by a
  screen-space lens shader (distortion, fringes, wobble, iris, a whip across between them, a reticle on the target).
  Its cameras are extra views for the tiles (`photo-city.ts` `extraViews`): prefetched after the flight, then loaded
  only near their beats, mostly one at a time. Coleraine is outside the photorealistic coverage (terrain and aerial
  photos only), so it's seen from further off. The ground there is ~45 units down, with the earth's curve.
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
  `flight.ts` (waypoints timed to the beats with `at`, each with an optional `heading` (else looking back along
  the path) and `zoom` (the dolly zoom under the cranes): out of the clouds under the H&W cranes, the SSE Arena, over
  City Hall looking NW (the telescope), down Adelaide Street, the Gasworks, north along the Lagan to Lanyon Place,
  then up. Place waypoints from the tiles, not OSM: the cranes move along their dock; the letterbox bars in App.vue
  (`letterboxAt`) go with the dolly zoom). The glide from
  orbit (`approachAt` in choreography, `glideFromOrbit` in PlanetScene) starts far north looking on past the pole,
  backs south past Northern Ireland still looking north, and sinks onto it, turning to the flight's starting
  heading; it runs along a great circle that passes beside the pole, as the planet's texture pinches at it. The
  climb out carries on along the flight's end heading (`climbFromHome`, `FLIGHT_ENDS`). `water.ts`, `starlings.ts`,
  `train.ts`, `plane.ts` and `boats.ts` animate the city; all but the water and starlings are moved by the scroll,
  timed to beats. The train leaves Lanyon Place in the Ocula beat and crosses the Lagan Railway Bridge as it's read,
  then heads east along the Bangor line. The plane takes off from Belfast City Airport and passes over the reader in
  the craft beat. A ferry comes in down Musgrave Channel past the cranes, and a tour boat comes down the Lagan under
  the train in the Ocula beat. The plane and boats are bigger, and fly or sail closer, than they would in life, so
  they read. `traffic.ts` drives cars along the main roads near the flight (plus a few named streets it passes),
  all on the GPU in two draw calls (models and points): the roads are points in a texture and each car's place is
  worked out from the time. Within 100 units they're little models (bigger than life close up); further off, points, fading out by 400. They sit
  on a top-down height render of the tiles around the camera, refreshed every second, in the browser only, like the
  tiles. `photo-materials.ts` holds the tile shader (haze and drifting cloud shadows, shared with the overlays) and
  the day sky.
- `scripts/belfast/water.mjs` → `public/belfast/water.png` (the water mask for `water.ts`, over `geo.ts`'s area), and
  `scripts/belfast/traffic.mjs` → `public/belfast/traffic.bin` (the traffic's roads, layout in the script header). The
  data, like the office footprints in `offices.ts`, is © OpenStreetMap contributors (credited in the attributions
  dialog); keep that credit.
- `src/data/jobs.ts`: experience content. Other copy lives in the `src/views/*` components.
- `public/textures/earth/` (desktop) and `public/textures/earth/low-res/` (mobile). `night-lights.jpg` is NASA's
  Black Marble 2016, credited in the attributions dialog.

## Gotchas (each of these cost real debugging time)

- **Don't name components `Tres<Something>` where `Something` is a three.js export.** `vue.config.js`
  treats those tags as Tres custom elements. `TresScene` once rendered a blank canvas (it matched
  `THREE.Scene`); that's why the scene component is called `PlanetScene`.
- **The camera is created up front and passed to `<TresCanvas :camera>`.** If it's declared inside the
  async scene, Tres first creates a default camera and then swaps it out. `EffectComposerPmndrs`
  rebuilds on that swap but its effects don't re-attach, so bloom silently disappears, depending on load timing.
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
- City shaders output linear colour (write constants via `lin()`).
- ScrollSmoother is desktop only. Touch devices use native scrolling, and the scene is sized in
  `100lvh` so mobile address-bar changes don't resize the canvas.

## Verifying visually

Run the site (or `npm run build` and serve `dist/`) and screenshot several scroll positions with
headless Chrome via Playwright, at desktop size (e.g. 1440×900) and at a phone size with touch and
coarse pointer (e.g. 390×844). Use real GPU flags (`--use-angle=metal --ignore-gpu-blocklist` on macOS)
or WebGL falls back to software. Check at least: the hero, the Northern Ireland marker, the dive into the clouds, the
Belfast flight (the intro caption, under both cranes, City Hall), all five Europe markers in frame (portrait is the tight
case), the planet reveal, and the content hand-off. Settling moves the scroll after it stops, so dispatch a
`touchstart` on window first to capture exact positions. Also test slow tile loads (`page.route` on `tile.googleapis.com`): the clouds should hold, then clear.
