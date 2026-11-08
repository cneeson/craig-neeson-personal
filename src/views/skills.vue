<script lang="ts" setup>
import SkillItem from './skill-item.vue'
import Divider from '../components/divider.vue';
import Heading from './heading.vue';

const skills = [
  { name: 'TypeScript', icon: 'ts' },
  { name: 'JavaScript', icon: 'js' },
  { name: 'React', icon: 'react' },
  { name: 'Vue', icon: 'vue' },
  { name: 'Nuxt', icon: 'nuxt' },
  { name: 'CSS', icon: 'css' },
  { name: 'HTML', icon: 'html' },
  { name: 'Tailwind', icon: 'tailwind' },
  { name: 'Three.js', icon: 'threejs' },
  { name: 'Node', icon: 'node' },
];
</script>

<template>
  <section class="skills">
    <div class="intro">
      <Heading>Skills</Heading>
      <p>
        I'm passionate about UI development and have extensive experience designing and building web and mobile interfaces. With deep expertise in JavaScript/TypeScript, I'm comfortable working in both vanilla JS and modern frameworks.
      </p>
      <p>
        I've led frontend architecture from scratch and thrive in collaborative environments—whether owning the entire UI or contributing as part of a team tackling complex design challenges.
      </p>
    </div>

    <Divider class="hidden md:block" />

    <ul class="list">
      <SkillItem v-for="skill in skills" :key="skill.name" :icon="`images/skills/${skill.icon}.svg`">
        {{ skill.name }}
      </SkillItem>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.skills {
  @apply flex flex-col md:flex-row gap-12 lg:gap-16 md:items-center;
}

.intro {
  @apply flex-1 flex flex-col gap-4 text-base lg:text-lg leading-relaxed text-slate-100;
}

.list {
  @apply flex-1 grid grid-cols-2 gap-x-8 gap-y-5;
}
</style>
