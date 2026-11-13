<script setup lang="ts">
import gsap from 'gsap';
import { ref, shallowRef } from 'vue';
import { route, type Mode } from '@/scene/director';
import { prefersReducedMotion } from '@/services/device';
import { goToOrbit, navigate } from '@/services/navigation';

/** The menu: along the top on wider screens, and along the bottom, in reach of a thumb, on phones. */
const items: { mode: Mode, label: string, icon: string }[] = [
  { mode: 'home', label: 'Home', icon: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z' },
  { mode: 'about', label: 'About', icon: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4 3.6-7 8-7s8 3 8 7z' },
  { mode: 'experience', label: 'Experience', icon: 'M9 4h6a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3V6a2 2 0 0 1 2-2zm0 3h6V6H9z' },
  { mode: 'skills', label: 'Skills', icon: 'M8 6 2 12l6 6 1.4-1.4L4.8 12l4.6-4.6zm8 0-1.4 1.4 4.6 4.6-4.6 4.6L16 18l6-6z' },
  { mode: 'contact', label: 'Contact', icon: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V17h16V7.4l-8 5.3z' },
];

// The name letter by letter, so each can lift off in turn on hover
const first = [...'Craig'];
const last = [...'Neeson'];

// The logo's hover, played from script so that it winds down rather than stopping dead when the pointer leaves:
// each letter's hop plays out (they then ease back to the line by CSS), and the moon slows to a stop as it fades
const brandRef = shallowRef<HTMLButtonElement>();
const isLit = ref(false);
const HOP: Keyframe[] = [
  { transform: 'none' },
  { transform: 'translateY(-0.32em) rotate(-4deg)', offset: 0.4 },
  { transform: 'translateY(0.03em)', offset: 0.75 },
  { transform: 'none' },
];
const hops = new Map<Element, Animation>();
let orbitSpeed: gsap.core.Tween | undefined;

const orbitOf = () => brandRef.value?.querySelector('.moon')?.getAnimations()[0];

const light = () => {
  if (isLit.value) return;
  isLit.value = true;
  if (prefersReducedMotion || !brandRef.value) return;
  brandRef.value.querySelectorAll<HTMLElement>('.letter').forEach(letter => {
    if (hops.get(letter)?.playState === 'running') return;
    const delay = Number(letter.style.getPropertyValue('--i')) * 35;
    hops.set(letter, letter.animate(HOP, { duration: 550, delay, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' }));
  });
  const orbit = orbitOf();
  if (!orbit) return;
  orbitSpeed?.kill();
  if (orbit.playState !== 'running') orbit.playbackRate = 0.3;
  orbit.play();
  orbitSpeed = gsap.to(orbit, { playbackRate: 1, duration: 0.4, ease: 'power1.out' });
};

const dim = () => {
  if (!isLit.value) return;
  isLit.value = false;
  const orbit = orbitOf();
  if (!orbit || orbit.playState !== 'running') return;
  orbitSpeed?.kill();
  orbitSpeed = gsap.to(orbit, { playbackRate: 0, duration: 1, ease: 'power2.out', onComplete: () => orbit.pause() });
};

// Keyboard focus lights it too, but not the focus a click leaves behind
const onFocus = (event: FocusEvent) => (event.target as Element).matches(':focus-visible') && light();
</script>

<template>
  <nav class="site-menu" :class="{ 'is-shown': route.isIntroDone }" aria-label="Site">
    <!-- Back up to orbit. On hover the letters lift off one after another, and a little moon swings round the name -->
    <button
      ref="brandRef"
      type="button"
      class="brand"
      :class="{ 'is-lit': isLit }"
      aria-label="Craig Neeson, back to orbit"
      @click="goToOrbit"
      @pointerenter="light"
      @pointerleave="dim"
      @focus="onFocus"
      @blur="dim"
    >
      <span class="name" aria-hidden="true">
        <span v-for="(letter, i) in first" :key="`f${i}`" class="letter" :style="{ '--i': i }">{{ letter }}</span>
        {{ ' ' }}
        <i><span v-for="(letter, i) in last" :key="`l${i}`" class="letter" :style="{ '--i': i + first.length + 1 }">{{ letter }}</span></i>
      </span>
      <span class="orbit" aria-hidden="true"><span class="moon" /></span>
    </button>
    <ul>
      <li v-for="item in items" :key="item.mode" :class="{ 'is-home': item.mode === 'home' }">
        <button
          type="button"
          :aria-current="route.mode === item.mode ? 'page' : undefined"
          @click="navigate(item.mode)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
          <!-- The label twice, the hidden copy in the current page's italic, so the menu keeps its width as that moves -->
          <span class="label" :data-label="item.label">{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style lang="scss" scoped>
@use "sass:math";

$ink: #f4efe6;

.site-menu {
  @apply fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 lg:px-10 py-4;

  opacity: 0;
  visibility: hidden;
  transform: translateY(-12px);
  transition: opacity 0.8s ease, transform 0.8s ease, visibility 0s linear 0.8s;
  background: linear-gradient(to bottom, rgba(9, 1, 24, 0.55), transparent);

  &.is-shown {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: opacity 0.8s ease, transform 0.8s ease;
  }
}

.brand {
  @apply text-xl lg:text-2xl;

  font-family: 'Fraunces', Georgia, serif;
  font-variation-settings: 'opsz' 144, 'wght' 700;
  color: $ink;
  text-shadow: 0 2px 12px rgba(9, 1, 24, 0.8);

  position: relative;
  isolation: isolate;

  // The surname set apart, as in the title
  i {
    font-variation-settings: 'opsz' 144, 'wght' 300;
  }

  .name {
    position: relative;
    z-index: 1;
  }

  // Raised by `translate` while lit, so the hops (on `transform`, from script) add to it
  .letter {
    display: inline-block;
    transition: translate 0.6s cubic-bezier(0.3, 0.7, 0.4, 1);
  }

  // The moon's orbit: a tilted ellipse round the name, passing behind the letters on its far side
  .orbit {
    position: absolute;
    inset: -0.2em -0.45em;
    pointer-events: none;
    opacity: 0;
    transition: opacity 1s ease;
  }

  .moon {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0.24em;
    height: 0.24em;
    margin: -0.12em 0 0 -0.12em;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #fff 0%, #f4c9a8 55%, #c98a6a 100%);
    box-shadow: 0 0 8px rgba(255, 214, 180, 0.8);
    // Played and slowed from script
    animation: moon-orbit 2.4s linear infinite paused;
  }

  &.is-lit {
    .letter {
      translate: 0 -0.07em;
      transition-delay: calc(var(--i) * 35ms + 0.4s);
    }

    .orbit {
      opacity: 1;
      transition-duration: 0.3s;
    }
  }

  &:focus-visible {
    outline: none;

    .name {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 0.25em;
    }
  }

  &:active .letter {
    translate: 0 -0.25em;
    transition-duration: 0.12s;
    transition-delay: 0s;
  }
}

// Round an ellipse half the name's width across and a little tilted: in front along the bottom, behind along the top
@keyframes moon-orbit {
  @for $step from 0 through 24 {
    $angle: calc(360deg * $step / 24);
    #{percentage(calc($step / 24))} {
      $x: math.cos($angle) * 2.75em;
      $y: math.sin($angle) * 0.55em + math.cos($angle) * -0.18em;
      $scale: 0.8 + math.sin($angle) * 0.25;
      transform: translate($x, $y) scale($scale);
      z-index: if(math.sin($angle) > 0, 2, 0);
    }
  }
}

// Reduced motion: no hops (see light), and the moon sits still beside the name
@media (prefers-reduced-motion: reduce) {
  .brand .letter {
    transition: none;
  }
}

ul {
  @apply flex gap-2 lg:gap-4;
}

li.is-home {
  display: none;
}

// Just the words: the page you're on in Instrument Serif's italic, the face kept for emphasis
li button {
  @apply relative px-3 py-2 text-sm lg:text-base font-medium text-white/70 transition-colors;

  letter-spacing: 0.01em;
  text-shadow: 0 1px 8px rgba(9, 1, 24, 0.9);

  svg {
    display: none;
  }

  .label {
    display: inline-grid;
    justify-items: center;

    &::after {
      content: attr(data-label);
      height: 0;
      overflow: hidden;
      visibility: hidden;
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: 1.2em;
      letter-spacing: 0;
    }
  }

  &:hover,
  &:focus-visible {
    color: $ink;
  }

  &:focus-visible {
    outline: none;
    text-decoration: underline;
    text-underline-offset: 0.3em;
  }

  &[aria-current='page'] {
    color: $ink;

    .label {
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-weight: 400;
      font-size: 1.2em;
      line-height: 1;
      letter-spacing: 0;

      // Here the hidden copy's the roman
      &::after {
        font-family: 'Satoshi', Helvetica, Arial, sans-serif;
        font-style: normal;
        font-weight: 500;
        font-size: calc(1em / 1.2);
        letter-spacing: 0.01em;
      }
    }
  }
}

// Phones: a bar of icons along the bottom
@media (max-width: 767px) {
  .site-menu {
    top: auto;
    bottom: 0;
    height: var(--menu-bottom);
    padding: 0 0 env(safe-area-inset-bottom);
    transform: translateY(12px);
    background: rgba(9, 1, 24, 0.82);
    border-top: 1px solid rgba(244, 239, 230, 0.12);
    backdrop-filter: blur(10px);
  }

  .brand {
    display: none;
  }

  ul {
    @apply w-full justify-around gap-0;
  }

  li.is-home {
    display: block;
  }

  li button {
    @apply flex flex-col items-center gap-1 px-2 py-1.5 text-[11px] rounded-xl;

    svg {
      display: block;
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    // A thin ring of ink round the page you're on, the label as the others (too small for the italic)
    &[aria-current='page'] {
      box-shadow: inset 0 0 0 1px rgba($ink, 0.45);

      .label {
        font: inherit;
        letter-spacing: inherit;
      }
    }

    .label::after {
      display: none;
    }
  }
}
</style>
