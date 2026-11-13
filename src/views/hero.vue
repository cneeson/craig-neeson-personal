<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { gsap } from 'gsap';
import ActionLink from '@/components/action-link.vue';
import { route, skipIntro } from '@/scene/director';
import { onOverlayFrame, screenOnEarth } from '@/scene/overlay';
import { onEarth, PLACES } from '@/scene/planet/geo';

const first = 'Craig';
const last = 'Neeson';
const note = 'based in Belfast';

const noteRef = ref<HTMLElement>();
const letters = ref<HTMLElement[]>([]);
const arrow = ref<SVGSVGElement>();
const shaft = ref<SVGPathElement>();
const head = ref<SVGPathElement>();

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The note, written by hand: a mask sweeps along the line, reaching the end of each letter in turn, quickly and
 * unevenly. Each word starts careful and runs on faster, every letter's a bit quicker or slower than the last, the pen
 * hesitates now and then (always before the capital) and the gaps between words vary.
 */
const writeNote = () => {
  const element = noteRef.value!;
  const timeline = gsap.timeline();
  const em = parseFloat(getComputedStyle(element).fontSize);
  timeline.set(element, { '--p': `${0.5 * em}px` });
  let indexInWord = 0;
  for (const letter of letters.value) {
    const end = letter.offsetLeft + letter.offsetWidth + 0.3 * em;
    if (letter.textContent === ' ') {
      timeline.set(element, { '--p': `${end}px` }, `>+${gsap.utils.random(0.05, 0.16)}`);
      indexInWord = 0;
      continue;
    }
    const runOn = Math.max(0.6, 1.3 - indexInWord * 0.12);
    const duration = gsap.utils.clamp(0.025, 0.12, (letter.offsetWidth / em) * 0.12) * runOn * gsap.utils.random(0.6, 1.5);
    const pause = letter.textContent === 'B' ? gsap.utils.random(0.06, 0.12)
      : Math.random() < 0.15 ? gsap.utils.random(0.03, 0.08) : -duration * 0.2;
    timeline.to(element, { '--p': `${end}px`, duration, ease: gsap.utils.random(['none', 'power1.in', 'power1.out']) },
      `>${pause >= 0 ? '+' : '-'}${Math.abs(pause)}`);
    indexInWord += 1;
  }
  timeline.set(element, { '--p': `${element.offsetWidth + em}px` });
  return timeline;
};

let context: gsap.Context | undefined;
let isWritten = false;
let fallback: number | undefined;

/**
 * The title, once the planet's risen into view: the name's letters rise sharp through a line, the surname landing in
 * bold and relaxing into its light italic, then the role word by word. Then the note's written, the arrow drawn from it
 * to Belfast, and the way in appears.
 */
const writeIn = (delay: number) => {
  if (isWritten) return;
  isWritten = true;
  // The note's letters must be in their own font before they're measured
  document.fonts.ready.then(() => context?.add(() => {
    const timeline = gsap.timeline({ delay })
      .to('[data-intro="first"]', { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.05, ease: 'expo.out' }, 0)
      .to('[data-intro="last"]', { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.045, ease: 'expo.out' }, 0.4)
      .to('[data-intro="last"]', {
        fontVariationSettings: "'opsz' 144, 'wght' 300", duration: 1.3, stagger: 0.04, ease: 'power2.inOut',
      }, 1.05)
      .to('[data-intro="word"]', { yPercent: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out' }, 1.45)
      .add(writeNote(), 2.35)
      // The arrow: the shaft in one stroke, a pause, the head
      .to(shaft.value!, { strokeDashoffset: 0, duration: 0.55, ease: 'power1.in' }, '>+0.12')
      .to(head.value!, { strokeDashoffset: 0, duration: 0.22, ease: 'power1.out' }, '>+0.08')
      .to('[data-intro="enter"]', { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '>-0.25')
      .fromTo('[data-intro="enter"] .mark', { scale: 0.6, rotate: -90 },
        { scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(1.6)' }, '<+0.1');
    if (prefersReducedMotion) timeline.progress(1);
  }));
};

// --- The arrow, from the note to Belfast on the planet, wherever it's turned to ---

const BELFAST = onEarth(PLACES.belfast.lat, PLACES.belfast.lon).multiplyScalar(1.01);
const belfast = { x: 0, y: 0 };
/** The note's box on screen, less the padding that makes room for its loops. Measured when the layout changes. */
let noteBox: { left: number, top: number, right: number, bottom: number } | null = null;
let em = 16;

const measure = () => {
  const element = noteRef.value;
  if (!element) return;
  const box = element.getBoundingClientRect();
  em = parseFloat(getComputedStyle(element).fontSize);
  const inset = 0.4 * em;
  noteBox = { left: box.left + inset, top: box.top + inset, right: box.right - inset, bottom: box.bottom - inset };
};

/** A curve from the side of the note facing Belfast, bowed like a flick of the wrist, stopping just short of it. */
const drawArrow = (to: { x: number, y: number }) => {
  if (!noteBox) return;
  const { left, top, right, bottom } = noteBox;
  const centre = { x: (left + right) / 2, y: (top + bottom) / 2 };
  const toX = to.x - centre.x;
  const toY = to.y - centre.y;
  // Off the end of the line if Belfast's more to the side than above or below it, otherwise from under it
  const fromSide = Math.abs(toX) * (bottom - top) > Math.abs(toY) * (right - left);
  const start = fromSide
    ? { x: toX > 0 ? right + 0.15 * em : left - 0.15 * em, y: centre.y + 0.2 * em }
    : { x: centre.x + toX * 0.15, y: toY > 0 ? bottom + 0.1 * em : top - 0.1 * em };
  const dx = to.x - start.x;
  const dy = to.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 2 * em) return;
  // Bowed out to the left of the way it's going (up and over, on the way down to the right)
  const bow = 0.22 * length;
  const nx = dy / length;
  const ny = -dx / length;
  const c1 = { x: start.x + dx * 0.3 + nx * bow, y: start.y + dy * 0.3 + ny * bow };
  const c2 = { x: start.x + dx * 0.78 + nx * bow * 0.45, y: start.y + dy * 0.78 + ny * bow * 0.45 };
  // Short of the place, so the city lights there stay clear
  const gap = 0.5 * em;
  const tx = to.x - c2.x;
  const ty = to.y - c2.y;
  const t = Math.hypot(tx, ty) || 1;
  const tip = { x: to.x - (tx / t) * gap, y: to.y - (ty / t) * gap };
  shaft.value?.setAttribute('d', `M${start.x} ${start.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${tip.x} ${tip.y}`);
  // The head: two barbs back from the tip, not quite even, as a hand would draw them
  const angle = Math.atan2(-ty, -tx);
  const barb = (spread: number, size: number) =>
    `${tip.x + Math.cos(angle + spread) * size} ${tip.y + Math.sin(angle + spread) * size}`;
  head.value?.setAttribute('d', `M${barb(0.5, 0.6 * em)}L${tip.x} ${tip.y}L${barb(-0.45, 0.68 * em)}`);
};

let stopArrow: (() => void) | undefined;

onMounted(() => {
  context = gsap.context(() => {
    // Hidden until the planet's up (its textures may take a while), but not for long if it never comes up
    gsap.set('[data-intro="first"], [data-intro="last"]', { yPercent: 115, rotate: 8 });
    gsap.set('[data-intro="last"]', { fontVariationSettings: "'opsz' 144, 'wght' 700" });
    gsap.set('[data-intro="word"]', { yPercent: 120 });
    gsap.set('[data-intro="enter"]', { autoAlpha: 0, y: 12 });
    gsap.set(noteRef.value!, { '--p': '0px' });
    // pathLength 1: the dash is the whole stroke, pushed past its start (and its round cap) until it's drawn
    gsap.set([shaft.value!, head.value!], { strokeDasharray: '1 1.2', strokeDashoffset: 1.1 });
  });
  watch(() => route.isPlanetUp, isUp => isUp && writeIn(2.4), { immediate: true });
  fallback = window.setTimeout(() => writeIn(0), 8000);

  document.fonts.ready.then(measure);
  window.addEventListener('resize', measure);
  stopArrow = onOverlayFrame(camera => {
    if (!route.isHeroUp || !arrow.value) return;
    const at = screenOnEarth(BELFAST, camera, arrow.value.clientWidth, arrow.value.clientHeight, belfast);
    arrow.value.classList.toggle('is-lost', !at);
    if (at) drawArrow(at);
  });
});

onBeforeUnmount(() => {
  window.clearTimeout(fallback);
  window.removeEventListener('resize', measure);
  stopArrow?.();
  context?.revert();
});
</script>

<template>
  <!-- The title beside the planet, until Enter sets off down to Belfast -->
  <section class="hero" :class="{ 'is-gone': !route.isHeroUp }">
    <div class="intro">
      <h1 class="name" :aria-label="`${first} ${last}`">
        <span class="clip" aria-hidden="true"><span class="first">
          <span v-for="(letter, index) in first" :key="index" class="char" data-intro="first">{{ letter }}</span>
        </span></span>
        {{ ' ' }}
        <span class="clip" aria-hidden="true"><span class="last">
          <span v-for="(letter, index) in last" :key="index" class="char" data-intro="last">{{ letter }}</span>
        </span></span>
      </h1>
      <p class="role">
        <span class="clip"><span class="word" data-intro="word">Senior</span></span>
        {{ ' ' }}
        <span class="clip"><i class="word" data-intro="word">Frontend</i></span>
        {{ ' ' }}
        <span class="clip"><span class="word" data-intro="word">Engineer</span></span>
      </p>

      <ActionLink ring class="enter" data-intro="enter" @click="skipIntro">Come in</ActionLink>

      <p ref="noteRef" class="note" :aria-label="note">
        <span
          v-for="(letter, index) in note"
          :key="index"
          :ref="element => element && (letters[index] = element as HTMLElement)"
          aria-hidden="true"
        >{{ letter }}</span>
      </p>
    </div>

    <svg ref="arrow" class="arrow" aria-hidden="true">
      <path ref="shaft" pathLength="1" />
      <path ref="head" pathLength="1" />
    </svg>
  </section>

  <button v-if="!route.isHeroUp && !route.isIntroDone" type="button" class="skip" @click="skipIntro">Skip ›</button>
</template>

<style lang="scss" scoped>
$ink: #f4efe6;
$peach: #f6b98a;

.hero {
  // Beside the planet: to its left on wide screens, above it on portrait ones
  @apply fixed inset-0 z-30 flex items-start justify-center text-center px-6 pt-[12vh];

  @media (min-aspect-ratio: 1/1) {
    @apply items-center justify-start text-left pt-0 pl-[7vw];
  }

  transition: opacity 1.2s ease, transform 1.2s ease, visibility 0s linear 0s;

  &.is-gone {
    opacity: 0;
    transform: translateY(-40px);
    visibility: hidden;
    pointer-events: none;
    transition: opacity 1.2s ease, transform 1.2s ease, visibility 0s linear 1.2s;
  }
}

.intro {
  @apply relative flex flex-col items-center;

  @media (min-aspect-ratio: 1/1) {
    @apply items-start;
  }
}

// Each part sits in a window it rises up through, padded for the descenders and the italic's lean
.clip {
  display: inline-block;
  overflow: clip;
  padding: 0.1em 0.12em 0.22em;
  margin: -0.1em -0.12em -0.22em;
  vertical-align: bottom;
}

.name {
  margin: 0;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 15vw;
  font-weight: 400;
  line-height: 0.92;
  color: $ink;
  white-space: nowrap;
  text-shadow: 0 0.04em 0.3em rgba(9, 1, 24, 0.45);

  @media (min-aspect-ratio: 1/1) {
    font-size: clamp(3.5rem, 7.5vw, 9rem);
  }

  .char {
    display: inline-block;
  }

  // Craig in bold, Neeson set apart in a light italic
  .first {
    font-variation-settings: 'opsz' 144, 'wght' 700;
  }

  .last {
    font-style: italic;
    font-variation-settings: 'opsz' 144, 'wght' 300;
  }
}

.role {
  @apply mt-4 text-slate-300;

  font-size: 5.4vw;
  text-shadow: 0 1px 12px rgba(9, 1, 24, 0.8);

  @media (min-aspect-ratio: 1/1) {
    @apply mt-[2vw];

    font-size: clamp(1.15rem, 2vw, 2.1rem);
  }

  .word {
    display: inline-block;
  }

  .clip {
    padding: 0.1em 0.1em 0.25em;
    margin: -0.1em -0.1em -0.25em;
  }

  i {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 1.15em;
    color: white;
  }
}

.enter {
  @apply mt-8;

  @media (min-aspect-ratio: 1/1) {
    @apply mt-[2.6vw];

    font-size: clamp(1rem, 1.25vw, 1.4rem);
  }
}

// The hand-written note. One mask over the whole line, padded well past the letters so Caveat's loops and the
// halo behind the ink aren't cut off; writeNote sweeps it along
.note {
  --p: 0px;
  position: absolute;
  top: calc(100% + 4vh);
  right: -2%;
  padding: 0.5em;
  margin: -0.5em;
  font-family: 'Caveat', cursive;
  font-weight: 600;
  font-size: 7vw;
  line-height: 1;
  color: $peach;
  white-space: nowrap;
  transform: rotate(-5deg);
  pointer-events: none;
  text-shadow: 0 0 0.04em rgba($peach, 0.6), 0 0 0.35em rgba(9, 1, 24, 0.9);
  mask-image: linear-gradient(90deg, #000 calc(var(--p) - 0.3em), transparent var(--p));

  // Above the name, off towards the planet
  @media (min-aspect-ratio: 1/1) {
    top: auto;
    right: auto;
    bottom: calc(100% + 7vh);
    left: 68%;
    font-size: clamp(1.4rem, 2.4vw, 2.8rem);
    transform: rotate(-6deg);
  }

  span {
    display: inline-block;
    white-space: pre;
  }
}

.arrow {
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  // Sized like the canvas (see .scene in App.vue), so Belfast's projection lines up
  height: 100vh;
  height: 100lvh;
  overflow: visible;
  pointer-events: none;
  transition: opacity 0.4s ease;

  &.is-lost {
    opacity: 0;
  }

  path {
    fill: none;
    stroke: $peach;
    stroke-width: clamp(2px, 0.17vw, 3.5px);
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 1px rgba($peach, 0.6)) drop-shadow(0 0 6px rgba(9, 1, 24, 0.8));
  }
}

.skip {
  @apply fixed right-5 bottom-5 z-30 px-4 py-2 rounded-full text-sm text-white/75;

  background: rgba(9, 1, 24, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);

  &:hover,
  &:focus-visible {
    @apply text-white;
  }
}
</style>
