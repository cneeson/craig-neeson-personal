<template>
   <Transition>
    <teleport to="body">
      <div v-if="isOpen" class="overlay">
        <dialog :open="isOpen">
          <button @click="emit('onClose')">×</button>
          <h1>Credit & Attributions</h1>
          <p>I was able to use many free resources from talented developers and 3D artists to create this website. I'm very grateful for their work and the time they've taken to share their knowledge and work. Special thanks to:</p>
        <ul class="mt-4 ml-4 list-disc">
          <li>
            High resolution earth textures downloaded with thanks from <a href="https://planetpixelemporium.com/earth8081.html" target="_blank">Planet Pixel Emporium.</a>
          </li>
          <li>
            SVG icons downloaded with thanks from <a href="www.svgrepo.com" target="_blank">SVG Repo.</a>
          </li>
          <li>
            Map pin 3D model downloaded with thanks from author iteacher, hosted on <a href="https://sketchfab.com/3d-models/map-pin-912de523d2284fb38253dbb0fb565a96" target="_blank">Sketchfab.</a>
          </li>
          <li>
            3D scene implemented with thanks to <a href="https://threejs.org/" target="_blank">ThreeJS</a> and the Vue-ported version <a href="https://tresjs.org/" target="_blank">TresJS.</a>
          </li>
          <li>
            Animations implemented with thanks to the amazing <a href="https://gsap.com/" target="_blank">GSAP</a> library.
          </li>
        </ul>
        </dialog>
      </div>
    </teleport>
  </Transition>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'AttributionsModal',
});
</script>

<script lang="ts" setup>

const emit = defineEmits(['onClose'])

defineProps<{
  isOpen: boolean
}>();
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

dialog {
  @apply text-white;
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  max-width: 600px;
  z-index: 1000;

  background: rgba(169, 169, 169, 0.2);
  border-radius: 5px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(169, 169, 169, 0.3);
  padding: 1.75rem;

  h1 {
    @apply text-4xl font-bold mb-6;
  }

  button {
    @apply absolute top-5 right-5 text-2xl cursor-pointer;
  }

  ul {
    li {
      @apply mb-2;

      a {
        @apply underline;
        color: #049ef4;
      }
    }
  }
}


.v-enter-active,
.v-leave-active {
  transition: opacity 0.2s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
