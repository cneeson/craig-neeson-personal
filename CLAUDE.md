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
```

There are no tests. Verify changes by running the site and looking at it (see Verifying).

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
- `src/components/city-marker.vue`: pin, label and glow. Driven entirely by `setOpacity(0..1)`.
- `src/scene/choreography.ts`: **the whole journey is a pure function of scroll progress (0..1)**.
  It holds:
  - the beat `windows` (where each caption is fully readable);
  - camera/earth keyframes, with optional portrait overrides, joined by monotone cubic splines so the
    camera never stops dead or reverses between keyframes;
  - `settleAt` (easing onto a nearby caption when scrolling stops);
  - the nav `chapters`.

  Tune the motion here. Keep keyframes on the window edges so the camera arrives as the caption does.
- `src/scene/captions.ts`: word-by-word caption entrances. They play in time rather than being
  scrubbed, so a caption always finishes revealing.
- `src/components/journey-nav.vue`: the chapter rail on the right (md and up).
- `src/scene/state.ts`: plain mutable `{ progress, exit }`, written by GSAP and read every frame by
  the render loop. Deliberately not reactive.
- `src/scene/camera.ts`: the camera instance handed to `<TresCanvas>` (see gotchas).
- `src/services/device.ts`: mobile detection (`pointer: coarse`) and the quality tiers (DPR cap,
  textures, star counts, blur).
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
- ScrollSmoother is desktop only. Touch devices use native scrolling, and the scene is sized in
  `100lvh` so mobile address-bar changes don't resize the canvas.

## Verifying visually

Run the site (or `npm run build` and serve `dist/`) and screenshot several scroll positions with
headless Chrome via Playwright, at desktop size (e.g. 1440×900) and at a phone size with touch and
coarse pointer (e.g. 390×844). Use real GPU flags (`--use-angle=metal --ignore-gpu-blocklist` on macOS)
or WebGL falls back to software. Check at least: the hero, the Northern Ireland marker, all five Europe
markers in frame (portrait is the tight case), the planet reveal, and the content hand-off.
