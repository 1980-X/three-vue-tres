<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ samples: number[]; level: number; active: boolean }>()
const points = computed(() => props.samples.map((sample, i) => `${i / Math.max(1, props.samples.length - 1) * 500},${24 - sample * 21}`).join(' '))
</script>
<template>
  <div class="ev-signal" :class="{ 'is-active': active }">
    <div class="ev-signal-label"><span class="ev-dot"/><span>音频输出</span><span class="ev-mono">{{ active ? Math.round(level * 100) : '—' }}<small v-if="active"> %</small></span></div>
    <svg viewBox="0 0 500 48" preserveAspectRatio="none" role="img" aria-label="实时音频波形"><path d="M0 24h500" class="ev-signal-baseline"/><polyline :points="points"/></svg>
    <span class="ev-signal-state">{{ active ? 'LIVE' : 'STANDBY' }}</span>
  </div>
</template>
