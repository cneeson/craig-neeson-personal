<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Scene, Vector3 } from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { isInBelfast } from '@/scene/choreography';
import { route } from '@/scene/director';
import { onOverlayFrame } from '@/scene/overlay';
import { shots } from '@/scene/shots';
import { sceneState } from '@/scene/state';
import { iconUrl, skills } from '@/data/skills';

/**
 * The skills, stood about Belfast: each technology's name and logo over a landmark, and a gig poster by the SSE
 * Arena billing the lot. Placed in the scene with a CSS3DRenderer that follows the city camera, each turned about
 * its upright to face it, and shown as the camera arrives at its stop.
 */

/** The poster: where it stands (scene units, 10 m) and its size (world units per CSS pixel). */
const POSTER = { position: new Vector3(-1, 6.5, 5.5), scale: 0.017 };
/** The labels are sized by how far they are from their stop's camera (world units per CSS pixel, per unit away). */
const LABEL_SIZE = 0.0006;

const root = ref<HTMLElement>();
const poster = ref<HTMLElement>();
const labels = ref<HTMLElement[]>([]);

const shown = new Map<HTMLElement, boolean>();
const toggle = (element: HTMLElement, isShown: boolean) => {
  if (shown.get(element) === isShown) return;
  shown.set(element, isShown);
  element.classList.toggle('is-shown', isShown);
};

let stop: (() => void) | undefined;
let renderer: CSS3DRenderer | undefined;

onMounted(() => {
  renderer = new CSS3DRenderer();
  root.value?.prepend(renderer.domElement);
  const scene = new Scene();
  const posterObject = new CSS3DObject(poster.value as HTMLElement);
  posterObject.position.copy(POSTER.position);
  posterObject.scale.setScalar(POSTER.scale);
  const labelObjects = skills.map((skill, i) => {
    const object = new CSS3DObject(labels.value[i]);
    const { x, y, z } = shots[skill.stop].pose;
    object.position.copy(skill.at);
    object.scale.setScalar(skill.at.distanceTo(new Vector3(x, y, z)) * LABEL_SIZE);
    return object;
  });
  scene.add(posterObject, ...labelObjects);
  let [width, height] = [0, 0];

  stop = onOverlayFrame(camera => {
    const isShowing = !!root.value && isInBelfast(sceneState.progress) && sceneState.cityReady && route.mode === 'skills';
    if (root.value) root.value.style.visibility = isShowing ? 'visible' : 'hidden';
    if (!isShowing || !root.value || !renderer) return;

    if (root.value.clientWidth !== width || root.value.clientHeight !== height) {
      [width, height] = [root.value.clientWidth, root.value.clientHeight];
      renderer.setSize(width, height);
    }
    const arriving = route.isArriving;
    toggle(posterObject.element, route.stop === 'arena' && arriving);
    skills.forEach((skill, i) => toggle(labelObjects[i].element, route.stop === skill.stop && arriving));
    // Turned about their uprights to face the camera
    [posterObject, ...labelObjects].forEach(object => {
      object.rotation.y = Math.atan2(camera.position.x - object.position.x, camera.position.z - object.position.z);
    });
    renderer.render(scene, camera);
  });
});

onBeforeUnmount(() => {
  stop?.();
  renderer?.domElement.remove();
});
</script>

<template>
  <div ref="root" class="skill-signs" aria-hidden="true">
    <!-- The renderer moves these into its own element -->
    <div hidden>
      <article ref="poster" class="sign poster">
        <p class="venue">Live at the SSE Arena</p>
        <p class="billing">Tonight</p>
        <p class="headliners">
          <span>TypeScript</span>
          <span>Vue</span>
          <span>React</span>
        </p>
        <p class="billing">With special guests</p>
        <p class="support">Nuxt · Node · Three.js · GSAP</p>
        <p class="billing">Doors open with</p>
        <p class="openers">HTML · CSS · Tailwind · JavaScript</p>
        <p class="small-print">All ages · Fully accessible venue</p>
      </article>
      <div v-for="skill in skills" :key="skill.name" ref="labels" class="sign">
        <div class="label">
          <img v-if="skill.icon" :src="iconUrl(skill.icon)" alt="" width="40" height="40">
          <span>{{ skill.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.skill-signs {
  position: fixed;
  inset: 0;
  // Sized like the canvas (see .scene in App.vue), so the projection lines up
  height: 100vh;
  height: 100lvh;
  z-index: 4;
  pointer-events: none;
  overflow: hidden;
  visibility: hidden;
}

.sign {
  // CSS3DObject makes its element take the pointer; nothing here should
  pointer-events: none !important;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s ease, visibility 0s linear 0.5s;
  color: white;

  &.is-shown {
    opacity: 1;
    visibility: inherit;
    transition: opacity 0.8s ease;
  }
}

// A name and logo over a landmark, standing on it rather than centred on it. The lift is on an inner element: on
// the object's own, it would be applied outside its matrix, in unscaled world units
.label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 12px 14px;
  border: 1px solid rgba(136, 184, 242, 0.6);
  border-radius: 999px;
  background: rgba(9, 1, 24, 0.7);
  box-shadow: 0 0 30px rgba(136, 184, 242, 0.35);
  font-family: 'Satoshi', Helvetica, Arial, sans-serif;
  font-size: 28px;
  font-weight: 700;
  white-space: nowrap;
  transform: translateY(-50%);

  img {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }
}

// A gig poster, pasted up by the arena
.poster {
  width: 320px;
  padding: 26px 24px 20px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 190, 90, 0.35), transparent 60%),
    linear-gradient(170deg, #2a0f4a, #12052a 70%);
  border: 3px solid #ffd27a;
  box-shadow: 0 0 40px rgba(255, 190, 90, 0.35);
  font-family: 'Satoshi', Helvetica, Arial, sans-serif;
  text-transform: uppercase;

  .venue {
    font-size: 11px;
    letter-spacing: 0.3em;
    color: #ffd27a;
  }

  .billing {
    margin-top: 14px;
    font-size: 10px;
    letter-spacing: 0.35em;
    color: rgba(255, 255, 255, 0.7);
  }

  .headliners {
    display: flex;
    flex-direction: column;
    margin-top: 4px;
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.01em;

    span:nth-child(2) {
      color: #ffd27a;
    }
  }

  .support {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 700;
  }

  .openers {
    margin-top: 4px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .small-print {
    margin-top: 18px;
    font-size: 8px;
    letter-spacing: 0.25em;
    color: rgba(255, 255, 255, 0.5);
  }
}

</style>
