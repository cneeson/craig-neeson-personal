<script setup lang="ts">
/**
 * The site's buttons. Most are just words and an arrow: the words underline on hover and the arrow nudges on. The main
 * action on a screen (`primary`) is a cream capsule with the arrow in a dark disc at its end, and on hover a ring of
 * cream and a glow grow out from its edge. A link with `href`, otherwise a button.
 */
withDefaults(defineProps<{ href?: string, primary?: boolean, icon?: 'arrow' | 'download' }>(), { icon: 'arrow' });

const paths = {
  arrow: 'M4 12h15M13 6l6 6-6 6',
  download: 'M12 4v13m0 0-5.5-5.5M12 17l5.5-5.5M5 21h14',
};
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :type="href ? undefined : 'button'"
    class="action-link"
    :class="[{ 'is-primary': primary }, `is-${icon}`]"
  >
    <span class="label"><slot /></span>
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path :d="paths[icon]" /></svg>
    </span>
  </component>
</template>

<style lang="scss" scoped>
$ink: #f4efe6;
$night: #090118;
$ease: cubic-bezier(0.65, 0, 0.35, 1);

.action-link {
  @apply inline-flex items-center gap-2 text-sm lg:text-base font-medium;

  color: $ink;
  letter-spacing: 0.01em;
  text-shadow: 0 1px 10px rgba(9, 1, 24, 0.8);

  &:focus-visible {
    outline: none;
  }
}

.label {
  position: relative;
  padding: 0.3em 0;

  &::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    bottom: 0.15em;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: right;
    transition: transform 0.45s $ease;
  }
}

.mark {
  display: grid;
  place-items: center;

  svg {
    width: 1.1em;
    height: 1.1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.45s $ease;
  }
}

.action-link:not(.is-primary) {
  &:hover,
  &:focus-visible {
    .label::after {
      transform: scaleX(1);
      transform-origin: left;
    }

    .mark svg {
      transform: translateX(0.25em);
    }
  }

  &.is-download:hover .mark svg,
  &.is-download:focus-visible .mark svg {
    transform: translateY(0.15em);
  }

  &:focus-visible .label {
    outline: 2px solid rgba($ink, 0.6);
    outline-offset: 2px;
  }
}

// The main action: a cream capsule, the arrow in a dark disc with a rim of cream round it
.is-primary {
  --height: 64px;

  gap: 0.85em;
  height: var(--height);
  padding: 5px 5px 5px 1.5em;
  border-radius: 999px;
  background: $ink;
  color: $night;
  font-weight: 600;
  text-shadow: none;
  // At rest the halo's shadows at nothing, so on hover they grow out from the edge rather than fade in
  box-shadow: 0 0 0 0 rgba($ink, 0.38), 0 0 0 0 rgba($ink, 0.5), 0 0 0 0 rgba($ink, 0.22);
  transition: box-shadow 0.45s cubic-bezier(0.33, 1, 0.68, 1);

  @media (max-width: 767px) {
    --height: 56px;
  }

  .mark {
    width: calc(var(--height) - 10px);
    height: calc(var(--height) - 10px);
    border-radius: 50%;
    background: $night;
    color: $ink;
  }

  &:hover,
  &:focus-visible {
    box-shadow: 0 0 0 6px rgba($ink, 0.38), 0 0 28px 4px rgba($ink, 0.5), 0 0 70px rgba($ink, 0.22);
  }
}
</style>
