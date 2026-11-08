<template>
  <dialog ref="dialogRef" class="attributions" aria-labelledby="attributions-title" @close="emit('close')" @click="onClick">
    <div class="panel">
      <button class="close" aria-label="Close" @click="emit('close')">×</button>
      <h2 id="attributions-title">Credit & Attributions</h2>
      <p>I was able to use many free resources from talented developers and 3D artists to create this website. I'm very grateful for their work and the time they've taken to share their knowledge and work. Special thanks to:</p>
      <ul>
        <li>
          High resolution earth textures downloaded with thanks from <a href="https://planetpixelemporium.com/earth8081.html" target="_blank" rel="noopener">Planet Pixel Emporium.</a>
        </li>
        <li>
          Belfast in 3D from <a href="https://developers.google.com/maps/documentation/tile/3d-tiles" target="_blank" rel="noopener">Google Photorealistic 3D Tiles</a>, with imagery and map data © Google and its data providers.
        </li>
        <li>
          The night-time Belfast (shown when the 3D tiles can't load) uses buildings, streets and waterways from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>, available under the Open Database License.
        </li>
        <li>
          SVG icons downloaded with thanks from <a href="https://www.svgrepo.com" target="_blank" rel="noopener">SVG Repo.</a>
        </li>
        <li>
          Northern Ireland's outline from <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth.</a>
        </li>
        <li>
          3D scene implemented with thanks to <a href="https://threejs.org/" target="_blank" rel="noopener">ThreeJS</a> and the Vue-ported version <a href="https://tresjs.org/" target="_blank" rel="noopener">TresJS.</a>
        </li>
        <li>
          Animations implemented with thanks to the amazing <a href="https://gsap.com/" target="_blank" rel="noopener">GSAP</a> library.
        </li>
      </ul>
    </div>
  </dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean
}>();

const emit = defineEmits(['close'])

const dialogRef = ref<HTMLDialogElement>();

// Native modal dialog: gives us focus trapping, Escape to close and inert page content for free
watch(() => props.isOpen, isOpen => {
  if (isOpen) dialogRef.value?.showModal();
  else dialogRef.value?.close();
});

// Clicks on the ::backdrop land on the <dialog> element itself
const onClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) emit('close');
};
</script>

<style lang="scss" scoped>
.attributions {
  @apply bg-transparent p-0 m-auto w-[calc(100%-2.5rem)] max-w-xl text-white;

  &::backdrop {
    background: rgba(9, 1, 24, 0.6);
    backdrop-filter: blur(4px);
  }

  &[open] {
    animation: fade-in 0.2s ease-out;
  }
}

.panel {
  @apply relative rounded-xl p-7 leading-relaxed;

  background: rgba(40, 32, 70, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  h2 {
    @apply text-3xl font-bold mb-5 pr-8;
  }

  ul {
    @apply mt-4 pl-5 list-disc flex flex-col gap-2;
  }

  a {
    @apply underline underline-offset-2;
    color: #88b8f2;
  }
}

.close {
  @apply absolute top-4 right-5 text-3xl leading-none text-slate-300 hover:text-white;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
</style>
