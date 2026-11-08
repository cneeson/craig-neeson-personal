<template>
  <dialog ref="dialogRef" class="employer-dialog" aria-labelledby="employer-dialog-title" @close="emit('close')" @click="onClick">
    <div v-if="stop" class="panel">
      <button class="close" aria-label="Close" @click="emit('close')">×</button>
      <p class="eyebrow">{{ stop.place }} · {{ stop.dates }}</p>
      <h2 id="employer-dialog-title"><CompanyLogo :stop="stop" :size="36" /></h2>
      <p class="role">{{ stop.role }}</p>

      <ul v-if="stop.details" class="points">
        <li v-for="detail in stop.details" :key="detail">{{ detail }}</li>
      </ul>

      <section v-for="job in stop.jobs" :key="job.role + job.startDate" class="job">
        <h3 v-if="stop.jobs.length > 1">
          {{ job.role }} <span class="dates">{{ formatDates(job) }}</span>
        </h3>
        <ul v-if="job.keyPoints.length" class="points">
          <li v-for="point in job.keyPoints" :key="point">{{ point }}</li>
        </ul>
        <p v-else class="placeholder">{{ stop.line }}</p>
      </section>

      <a v-if="stop.jobs[0]?.href" class="link" :href="stop.jobs[0].href" target="_blank" rel="noopener">
        Visit {{ stop.name }} ↗
      </a>
    </div>
  </dialog>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { format } from 'date-fns';
import type { Job } from '@/data/jobs';
import type { Stop } from '@/data/journey';
import CompanyLogo from './company-logo.vue';

/** The details behind a sign over the city: the key points of each role there. */
const props = defineProps<{
  stop: Stop | null
}>();

const emit = defineEmits(['close']);

const dialogRef = ref<HTMLDialogElement>();

// Native modal dialog: gives us focus trapping, Escape to close and inert page content for free
watch(() => props.stop, stop => {
  if (stop) dialogRef.value?.showModal();
  else dialogRef.value?.close();
}, { flush: 'post' });

// Clicks on the ::backdrop land on the <dialog> element itself
const onClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) emit('close');
};

const formatDates = (job: Job) => {
  const month = (date: string) => format(new Date(date), 'MMM yyyy');
  return `${month(job.startDate)} – ${job.endDate ? month(job.endDate) : 'now'}`;
};
</script>

<style lang="scss" scoped>
.employer-dialog {
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
  @apply relative rounded-xl p-7 leading-relaxed max-h-[85vh] overflow-y-auto;

  background: rgba(40, 32, 70, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  h2 {
    @apply mt-3 mb-3 pr-8;
  }

  h3 {
    @apply mt-5 font-bold;
  }
}

.eyebrow {
  @apply text-xs uppercase tracking-[0.18em] mb-1;
  color: #88b8f2;
}

.role {
  @apply text-slate-300 mb-2;
}

.dates {
  @apply font-normal text-sm text-slate-400 ml-1;
}

.points {
  @apply mt-3 pl-5 list-disc flex flex-col gap-2 text-slate-200;
}

.placeholder {
  @apply mt-3 text-slate-200;
}

.link {
  @apply inline-block mt-6 underline underline-offset-2;
  color: #88b8f2;
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
