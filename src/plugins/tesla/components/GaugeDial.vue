<script setup lang="ts">
import { computed, useId } from 'vue'
const props = withDefaults(defineProps<{ id: string; value: number; max: number; label: string; unit: string; accent?: boolean; decimals?: number; redline?: number; unknown?: boolean }>(), { decimals: 0, redline: 0, unknown: false })
const instanceId = useId()
const gradientId = computed(() => `tesla-${instanceId}-${props.id}-glow`)
const point = (angle: number, radius: number) => ({ x: 160 + radius * Math.cos(angle * Math.PI / 180), y: 160 + radius * Math.sin(angle * Math.PI / 180) })
const angle = computed(() => 140 + 260 * Math.min(1, Math.max(0, props.value / props.max)))
function arc(start: number, end: number, r = 132) {
  const a = point(start, r), b = point(end, r)
  return `M${a.x} ${a.y} A${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y}`
}
const ticks = computed(() => {
  const total = (props.unit === 'rpm' ? props.max / 1000 : 6) * 5
  return Array.from({ length: total + 1 }, (_, i) => {
    const a = 140 + i / total * 260, major = i % 5 === 0
    return { a: point(a, major ? 111 : 116), b: point(a, 124), text: point(a, 94), major, value: Math.round(i / total * props.max / (props.unit === 'rpm' ? 1000 : 1)), red: props.redline > 0 && i / total * props.max >= props.redline }
  })
})
const tip = computed(() => point(angle.value, 104))
const tail = computed(() => point(angle.value + 180, 14))
const display = computed(() => props.unknown ? '—' : Math.max(0, props.value).toFixed(props.decimals))
</script>

<template>
  <div class="ev-gauge" :class="{ 'ev-gauge-accent': accent }">
    <svg viewBox="0 0 320 290" role="img" :aria-label="unknown ? `${label} 暂无数据` : `${label} ${display} ${unit}`">
      <defs><radialGradient :id="gradientId"><stop offset="0%" stop-color="currentColor" stop-opacity=".045"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>
      <circle cx="160" cy="160" r="143" :fill="`url(#${gradientId})`"/>
      <path :d="arc(140, 400)" class="ev-gauge-track" />
      <path v-if="redline" :d="arc(140 + redline / max * 260, 400)" class="ev-gauge-red" />
      <path v-if="!unknown && value > 0.1" :d="arc(140, Math.max(140.1, angle))" class="ev-gauge-progress" />
      <g v-for="(tick, i) in ticks" :key="i" :class="{ 'ev-tick-red': tick.red }">
        <line :x1="tick.a.x" :y1="tick.a.y" :x2="tick.b.x" :y2="tick.b.y" :class="tick.major ? 'ev-tick-major' : 'ev-tick'" />
        <text v-if="tick.major" :x="tick.text.x" :y="tick.text.y + 4" text-anchor="middle" class="ev-tick-label">{{ tick.value }}</text>
      </g>
      <line v-if="!unknown" :x1="tail.x" :y1="tail.y" :x2="tip.x" :y2="tip.y" class="ev-gauge-needle" />
      <circle cx="160" cy="160" r="6" fill="#15181b" stroke="currentColor" stroke-width="2" />
      <rect x="104" y="175" width="112" height="65" rx="8" fill="#14171a" />
      <text x="160" y="206" text-anchor="middle" class="ev-gauge-value">{{ display }}</text>
      <text x="160" y="230" text-anchor="middle" class="ev-gauge-unit">{{ unit === 'rpm' ? 'RPM' : unit }}</text>
      <text x="160" y="274" text-anchor="middle" class="ev-gauge-title">{{ label }}</text>
    </svg>
  </div>
</template>
