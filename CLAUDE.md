# craig-neeson-personal

Craig Neeson's personal site: one full-screen 3D scene and nothing that scrolls. It opens on the planet, glides
down through the clouds to a hover over Belfast (home), and a menu (About, Experience, Skills, Contact) flies the
camera between stops over the city, with a panel for each. Live at https://craigneeson.co.uk.

## Stack

- Vue 3 (`<script setup>`, TypeScript) on **Vue CLI 5 / webpack**, not Vite
- TresJS 5 (`@tresjs/core`, `@tresjs/cientos`, `@tresjs/post-processing` 3) over three.js. Tres 5 is ESM-only and
  reaches for `THREE.Timer` behind a revision check, which webpack would fail on with our three (r176), so
  `vue.config.js` turns off its missing-export check for `@tresjs`
- GSAP 3 (tweens and timelines for the camera moves and the intro; ScrollTrigger and ScrollSmoother are no longer used)
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
key, or if the tiles fail, the city isn't mounted and the camera stays in the clouds (the panels still work).
Each visit that reaches the city starts a billable root-tileset session.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which lints, builds and publishes `dist/` to
GitHub Pages (source: GitHub Actions). PRs run the lint and build only. The custom domain comes
from `public/CNAME`. Nothing is built into the repo: `docs/` is legacy output and is gitignored.

## Layout

- `src/App.vue`: page shell. The fixed `.scene` canvas, the overlays, the letterbox, the hero, the mode panels and
  the menu, and the shared panel styles. `html[data-mode]` carries the mode; `--menu-bottom` (the bottom menu on
  phones) and `--chrome-bottom` (plus the timeline in Experience) say how much of the bottom of the screen is taken.
- `src/scene/director.ts`: **what's on screen is driven by the director, not scroll.** `modes` lists each mode's
  stops (home; about: hello, craft, reach; experience: overview then the employers; skills: docks, arena, lagan;
  contact). `go(mode, step)` flies the city camera from wherever it is to the stop's shot (a Bézier lifted with the
  distance, so long hops rise over the roofs; a click mid-flight redirects it), or for `reach` climbs out to the
  planet by tweening `sceneState.progress` through the choreography and back. `route` (reactive) says where it is and
  whether the camera's arriving; `cityState` (plain, read every frame) holds what's eased in time: the offices'
  highlights, the Paris arc, the telescope, the letterbox, the train. `startIntro` plays the hero and the glide; a
  stop asked for during it (a deep link, a click) waits in `pending` until the city has loaded.
- `src/scene/shots.ts`: the city framings (`{ x, y, z, pitch, heading, zoom }`, scene units and degrees), each with an
  optional `drift` while held, or a time-based `at` (the home hover's slow sweep). `placeCamera` puts a camera at a
  pose (and tilts portrait screens down, so the city fills the space above the panels). Place shots from the tiles,
  not OSM: the cranes move along their dock.
- `src/services/navigation.ts`: the address (`#experience/ankorstore`; a mode change pushes history, stepping
  replaces it), and the input: wheel (one step per flick), swipe, arrows/PageUp/PageDown/Space, Escape/Home to go
  home. Stepping carries on into the next mode at the ends. `[data-scrolls]` and open dialogs scroll instead.
- `src/components/site-menu.vue` (top bar; a bottom icon bar on phones), `home-panel.vue`, `about-panel.vue` (the
  captions, written in word by word), `experience-timeline.vue` (the intro card and the strip of employers along the
  bottom), `skills-panel.vue`, `contact-panel.vue` (with the attributions dialog). `src/views/hero.vue` is the title
  over the planet, with the hand-written "based in Belfast" and its arrow, redrawn every frame to Belfast on the
  planet (`screenOnEarth` in `overlay.ts`).
- Type: one job per face (loaded in `public/index.html`). Fraunces for the name and headings (the surname always in
  its light italic), Instrument Serif's italic for a word of emphasis (and the menu's current page), Caveat for the
  hero's one note and nothing else, Satoshi for the rest. Buttons are `action-link.vue`: words and an arrow, the
  screen's main action (`primary`) a cream capsule with the arrow in a dark disc, a halo growing out on hover. Cream (`#f4efe6`) for actions, peach for the hand.
- `src/components/PlanetScene.vue`: the Tres scene (earth, clouds, atmosphere, stars, markers, bloom + SMAA) and
  the render loop. Must stay inside `<Suspense>` because it awaits textures.
- `src/scene/earth.ts`: the earth's material (the day map plus NASA Black Marble city lights where the scene's sun
  doesn't reach, coming on through dusk, and a haze towards the disc's edge) and the atmosphere shell, which glows
  by how close each line of sight passes to the ground, so it works from orbit and from just above the clouds.
- `src/components/belfast-photo.vue`: Belfast by day, from Google Photorealistic 3D Tiles
  (`src/scene/belfast/photo-city.ts`, via `3d-tiles-renderer`). Mounted once the planet has risen into view (setting it up stalls a frame). Extra cameras
  at the shots (`setCamera`) load it ahead of the reader: the arrival and the first stop (`firstShot`) first (then
  it's drawn off screen to warm the GPU and `sceneState.cityReady` is set), the destination of each move while
  flying, and a prefetch camera walks the other shots while it's held still. The
  whole city doesn't fit in the tile cache, so evicted tiles come back from the browser's HTTP cache. Keep the
  views few and the cache well above what they need: once it's full, tiles the reader's view needs are refused
  and the city flickers between levels of detail. The tile shader is swapped in by a plugin (`processTileModel`)
  so `TilesFadePlugin` can cross-fade levels; it needs `#include <dithering_fragment>` in that shader. Google's
  terms forbid hosting or bundling the tiles: only load them in the browser, in the same visit. Their
  attribution (logo + data providers) must stay visible while they're on screen (`city-attribution.vue`).
- `src/components/cloud-veil.vue`: full-screen cloud layer hiding the planet ↔ city switch (`veilAt`). It holds,
  then fades, if the city hasn't loaded by the time the reader gets there.
- `src/components/planet-hud.vue`: DOM overlays pinned to the planet (the labels where the reach arcs land). Positioned every frame through `onOverlayFrame` (`src/scene/overlay.ts`), which
  the render loop calls with the camera; shown and hidden in time by class.
- `src/components/city-signs.vue`: Experience's text over Belfast. Each employer gets a callout flat to the screen,
  with a dot on its building and a leader up to a card kept inside the viewport (in the sky instead if the building's
  out of view, as on narrow screens, and always for Ankorstore); the telescope stops' cards wait for the eyepieces. The
  overview has a pin on each building that flies to it. The cards' buttons open `employer-dialog.vue` with the role's
  key points from `src/data/journey.ts` (the stops) and `jobs.ts`. Only the buttons take the pointer, so swipes over
  the rest still step.
- `src/components/skill-signs.vue`: the skills (`src/data/skills.ts`), each a logo and name over a landmark, and the gig
  poster by the SSE Arena, in a CSS3DRenderer following the city camera, turned to face it. Offsets on a CSS3D
  object's own element are applied outside its matrix, in unscaled world units, so put them on a child.
- `src/scene/belfast/offices.ts`: the employers' buildings (OSM footprints, rough heights), outlined in light while
  their stop is up (faintly, all of them, in the overview), and the callouts' anchors. Frame each stop's shot on its
  building in `shots.ts`.
  `paris-arc.ts` draws the arc from Ormeau Business Park in the Gasworks towards Paris for Ankorstore.
- `src/scene/belfast/telescope.ts`: the coin-op telescope over City Hall. A camera of its own about a
  kilometre or so short of each place (Coleraine, then Antrim) renders into a texture, shown through the eyepieces by a
  screen-space lens shader (distortion, fringes, wobble, iris, a whip across between them, a reticle on the target).
  Its cameras are extra views for the tiles (`photo-city.ts` `extraViews`): prefetched after the shots, then loaded
  only at their stops. Coleraine is outside the photorealistic coverage (terrain and aerial photos only), so its
  campus buildings are outlined, like Nitec's (`offices.ts`, from OSM). Out there, convert lat/lon with WGS84
  east/north/up from the origin (the tiles' frame), not the flat conversion in `geo.ts`, which drifts by nearly a
  kilometre at Coleraine. The ground there is ~45 units down, with the earth's curve.
- `src/scene/planet/`: the effects on the planet. `clouds.ts` patches the cloud layer to gather over Northern Ireland
  and part over it (the centre must be turned into the cloud mesh's spinning space); `highlight.ts` traces the
  outline (`northern-ireland.ts`, from Natural Earth) and scans the land; `belfast-sign.ts` is Belfast's name in a
  contour, hung over it on the way down at the distance of a point on the glide (`SIGN_PASS`), so the camera flies
  through it; `cloud-deck.ts` is a deck of heaped cloud above the planet's, over Belfast, which the camera comes
  down through after the sign (`deckAt`): a stack of slices over a map of the cloud baked once in the warm-up (each
  slice needs denser cloud the higher it is, so they dome). Close to it, it reaches out past the horizon, the map
  mirrored beyond its edges, so it seems to go all round the planet; `arcs.ts` draws the arcs to the HQs.
  `geo.ts` converts lat/lon to the earth group's space (`onEarth`) and holds `EARTH_POSITION`.
- `src/scene/choreography.ts`: the planet's part, as a pure function of the journey's progress (0..1), which the
  director tweens (the intro's glide, the climb out to `reach` and back). It holds the `windows` (hero, forecast,
  Northern Ireland, Belfast, reach, reveal), the camera/earth keyframes (with optional portrait overrides, joined by
  monotone cubic splines so the camera never stops dead or reverses), and the dive into Belfast (`diveAt`, `veilAt`,
  `isInBelfast`). Progress inside the Belfast window means the city is on screen.
- `src/scene/captions.ts`: word-by-word caption entrances, played in time.
- `src/scene/state.ts`: plain mutable `{ progress, cityReady }`, written by GSAP and the city and read every frame by
  the render loop. Deliberately not reactive.
- `src/scene/camera.ts`: the camera instance handed to `<TresCanvas>` (see gotchas).
- `src/services/device.ts`: mobile detection (`pointer: coarse`) and the quality tiers (DPR cap,
  textures, star counts, blur).
- `src/scene/belfast/`: the city. `geo.ts` (origin and bounds; must match the build script). The glide from
  orbit (`approachAt` in choreography, `glideFromOrbit` in PlanetScene) starts far north looking on past the pole,
  backs south past Northern Ireland still looking north, and sinks onto it, turning to the arrival shot's heading
  (under the H&W cranes); it runs along a great circle that passes beside the pole, as the planet's texture pinches
  at it. The climb out carries on along `CITY_ENDS.end` (`climbFromHome`). `water.ts`, `starlings.ts`, `train.ts`,
  `plane.ts` and `boats.ts` animate the city, in time. The train leaves Lanyon Place when the Ocula stop is reached
  and crosses the Lagan Railway Bridge, then heads east along the Bangor line. The plane takes off from Belfast City
  Airport and passes over the cranes every 90 s. A ferry comes in down Musgrave Channel past the cranes, and a tour
  boat comes down the Lagan. The plane and boats are bigger, and fly or sail closer, than they would in life, so
  they read. `traffic.ts` drives cars along the main roads near the shots (plus a few named streets they show),
  all on the GPU in two draw calls (models and points): the roads are points in a texture and each car's place is
  worked out from the time. Within 100 units they're little models (small enough to stay in their lanes); further off, points, fading out by 650. They sit
  on a top-down height render of the tiles around the camera, refreshed every second, in the browser only, like the
  tiles. `photo-materials.ts` holds the tile shader (haze and drifting cloud shadows, shared with the overlays) and
  the day sky.
- `scripts/belfast/water.mjs` → `public/belfast/water.png` (the water mask for `water.ts`, over `geo.ts`'s area), and
  `scripts/belfast/traffic.mjs` → `public/belfast/traffic.bin` (the traffic's roads, layout in the script header). The
  data, like the office footprints in `offices.ts`, is © OpenStreetMap contributors (credited in the attributions
  dialog); keep that credit.
- `src/data/jobs.ts`: experience content; `src/data/skills.ts` the skills and their landmarks. Other copy lives in the
  panels.
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
- In `<script setup>` with top-level `await`, call `defineExpose` (and anything the parent needs
  immediately) **before** the first await.
- Rendering is `render-mode="on-demand"`; the loop (`useLoop().onBeforeRender`) calls `invalidate()` every frame.
  `useTres().renderer` is the renderer itself (typed as WebGL or WebGPU, so it's cast to `WebGLRenderer`), not a ref.
- The captions are rendered `v-once` because `createCaption` splits their text into word spans. A Vue
  re-render would fight that.
- **A shader first compiled mid-flight stalls the frame**, so the planet and the city are warmed up ahead
  (`src/scene/warm.ts`). Three things make a warm-up miss: it must compile into a linear half-float target like the
  bloom's (three keys programs by output colour space), with the lights that will really be on (the planet's are
  hidden for the city), and then really draw once, as ANGLE on Metal only finishes a program on its first draw. A
  program is also let go when its last material is disposed, which tile churn does constantly, so
  `belfast-photo.vue` keeps two never-drawn tile materials alive.
- The stars are tiny and rely on bloom to be visible. If they vanish, check the composer first.
- City scale is 1 unit = 10 m, at the world origin. The planet group is hidden while in the city (and vice versa),
  and the camera's fov/near change on the switch (`setLens`), which happens under full cloud cover.
- City shaders output linear colour (write constants via `lin()`).
- The page doesn't scroll (`overflow: hidden`, and touchmove is cancelled outside `[data-scrolls]`). The scene is
  sized in `100lvh` so mobile address-bar changes don't resize the canvas.

## Verifying visually

Add `?debug` to the address for the checking tools: the descent's speed, and a hand-held city camera that reads
off its pose (for placing shots in `shots.ts`).

Run the site (or `npm run build` and serve `dist/`) and screenshot the stops (set `location.hash`, e.g.
`#experience/flexera`, and wait for the move) with headless Chrome via Playwright, at desktop size (e.g. 1440×900) and at a phone size with touch and
coarse pointer (e.g. 390×844). Use real GPU flags (`--use-angle=metal --ignore-gpu-blocklist` on macOS)
or WebGL falls back to software. Check at least: the hero, the Northern Ireland marker, the glide into the clouds,
home, each About step (the arcs at `reach` in frame; portrait is the tight case), the overview and every employer
(cards, dialog, the telescope), each skills stop (labels clear of the panel), contact, a deep link, stepping with the
wheel, keys and a swipe, and redirecting a move mid-flight. Also test slow tile loads (`page.route` on
`tile.googleapis.com`): the clouds should hold, then clear.
