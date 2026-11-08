<script lang="ts" setup>
import Heading from './heading.vue';
import JobItem from './job-item.vue';
import { jobs } from '@/data/jobs';
</script>

<template>
  <section class="experience">
    <Heading data-reveal>Experience</Heading>

    <ol class="flex flex-col gap-6 lg:gap-8">
      <li v-for="job in jobs" :key="`${job.employer}-${job.startDate}`" data-reveal>
        <JobItem :job="job" />
      </li>
    </ol>
  </section>
</template>
