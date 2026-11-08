<script lang="ts" setup>
import { computed } from 'vue';
import { format, formatDistanceStrict } from 'date-fns'
import type { Job } from '@/data/jobs';

const props = defineProps<{
  job: Job;
}>();

const dates = computed(() => {
  const start = new Date(props.job.startDate);
  const end = props.job.endDate ? new Date(props.job.endDate) : new Date();
  const range = `${format(start, 'MMM yyyy')} – ${props.job.endDate ? format(end, 'MMM yyyy') : 'Present'}`;
  return `${range} · ${formatDistanceStrict(start, end)}`;
});
</script>

<template>
  <article class="job-item">
    <header class="flex items-center gap-4" :class="{ 'mb-5': job.keyPoints.length }">
      <img :src="job.imgSrc" :alt="`${job.employer} logo`" class="w-14 h-14 lg:w-16 lg:h-16 rounded-lg object-cover shrink-0" loading="lazy" />
      <div>
        <h3 class="text-lg lg:text-xl font-bold">
          <a :href="job.href" target="_blank" rel="noopener" class="hover:underline underline-offset-4">{{ job.employer }}</a>
        </h3>
        <p class="text-slate-200">{{ job.role }}</p>
        <p class="text-xs text-slate-300 mt-1">{{ dates }}</p>
      </div>
    </header>

    <ul v-if="job.keyPoints.length">
      <li v-for="point in job.keyPoints" :key="point">{{ point }}</li>
    </ul>
  </article>
</template>

<style lang="scss" scoped>
.job-item {
  @apply p-6 lg:p-8 rounded-xl text-white;

  background: rgba(169, 169, 169, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  ul {
    @apply list-disc pl-5 flex flex-col gap-3 text-sm lg:text-base leading-relaxed text-slate-100;
  }

  li::marker {
    color: #88b8f2;
  }
}
</style>
