<template>
  <primitive :object="veil" />
</template>

<script lang="ts" setup>
import { Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { onBeforeUnmount } from 'vue';

/**
 * A full-screen layer of moonlit cloud that the camera flies through, hiding the switch between
 * the planet and the city. Driven by `update`: 0 is clear, 1 is solid cloud. Clouds gather at the
 * edges first, and stream outwards as the reader scrolls, so it feels like flying into them.
 */
const material = new ShaderMaterial({
  uniforms: {
    uVeil: { value: 0 },
    uTravel: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uVeil;
    uniform float uTravel;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float value = 0.0, amplitude = 0.5;
      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = p * 2.03 + 17.1;
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float r = length(p);

      // Two layers zooming outwards in turn, cross-faded so the zoom loops seamlessly
      float density = 0.0;
      for (int i = 0; i < 2; i++) {
        float phase = fract(uTravel + float(i) * 0.5);
        float scale = 3.0 * exp2(-phase);
        float weight = 1.0 - abs(phase * 2.0 - 1.0);
        density += fbm(p * scale + float(i) * 31.7) * weight;
      }

      float cover = density - 1.0 + uVeil * 1.7 + (r - 0.45) * 0.6 * (1.0 - uVeil);
      float alpha = clamp(cover * 3.0, 0.0, 1.0);
      vec3 shadow = pow(vec3(0.16, 0.15, 0.26), vec3(2.2));
      vec3 lit = pow(vec3(0.62, 0.62, 0.76), vec3(2.2));
      vec3 color = mix(shadow, lit, smoothstep(0.35, 0.85, density));
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthTest: false,
  depthWrite: false,
});

const veil = new Mesh(new PlaneGeometry(2, 2), material);
veil.frustumCulled = false;
veil.renderOrder = 1000;
veil.visible = false;

onBeforeUnmount(() => {
  veil.geometry.dispose();
  material.dispose();
});

defineExpose({
  update(amount: number, travel: number, aspect: number) {
    veil.visible = amount > 0.001;
    material.uniforms.uVeil.value = amount;
    material.uniforms.uTravel.value = travel;
    material.uniforms.uAspect.value = aspect;
  },
});
</script>
