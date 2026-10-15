<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
const paths: Record<string, string[]> = {
  bolt: ['m13 2-9 12h7l-1 8 10-12h-7l1-8Z'],
  gauge: ['M3 16a9 9 0 1 1 18 0', 'm12 13 4-5', 'M6 20h12'],
  activity: ['M2 12h4l3-8 5 16 3-8h5'],
  gps: ['M12 2v3m0 14v3M2 12h3m14 0h3', 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
  play: ['m8 4 12 8-12 8V4Z'],
  stop: ['M5 5h14v14H5z'],
  volume: ['m11 4-6 5H2v6h3l6 5V4Z', 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'],
  check: ['m5 12 4 4L19 6'],
  arrow: ['M5 12h14m-5-5 5 5-5 5'],
  chevron: ['m8 4 8 8-8 8'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1'],
  warning: ['m12 3 10 18H2L12 3Z', 'M12 9v4m0 4h.01'],
  download: ['M12 3v12m-5-5 5 5 5-5', 'M4 16v5h16v-5'],
  settings: ['M4 7h16M4 17h16', 'M8 4v6m8 4v6'],
  loader: ['M21 12a9 9 0 1 1-9-9'],
  car: ['m5 7 2-4h10l2 4m-16 0h18v12H3V7Z', 'M6 12h2m8 0h2M6 19v2m12-2v2'],
  arrowUp: ['M12 20V4m-6 6 6-6 6 6'],
  arrowDown: ['M12 4v16m-6-6 6 6 6-6'],
  clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 7v5l3 2'],
  info: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 11v6m0-10h.01'],
}
const data = computed(() => paths[props.name] || paths.activity)
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="(path, i) in data" :key="i" :d="path" /></svg>
</template>
