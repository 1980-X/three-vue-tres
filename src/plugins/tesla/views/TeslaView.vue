<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useEngine } from '../composables/engineContext'
import GaugeDial from '../components/GaugeDial.vue'
import UiIcon from '../components/UiIcon.vue'
import type { PageName } from '../engine/types'

const emit = defineEmits<{ navigate: [page: PageName] }>()
const { state, controller, profiles } = useEngine()
const manuallyPaused = ref(false)
let disposed = false
let automaticGeneration = 0
const profile = computed(() => profiles.find(p => p.id === state.value.profileId)!)
const active = computed(() => state.value.status === 'running' || state.value.status === 'switching')
const busy = computed(() => state.value.status === 'starting' || state.value.status === 'switching')
const fresh = computed(() => state.value.motion.quality === 'fresh')
const speed = computed(() => fresh.value ? state.value.motion.speedMps * 3.6 : 0)
const rpmMax = computed(() => Math.ceil((profile.value.config.engine.limiterRpm || profile.value.config.engine.redlineRpm) / 1000) * 1000)
const gpsLabel = computed(() => ({ denied: '需要允许定位', unsupported: '浏览器不支持定位', insecure: '需要 HTTPS 连接', unavailable: '正在寻找定位信号', requesting: '等待位置授权', waiting: '等待位置更新' } as Record<string, string>)[state.value.gpsStatus] || (fresh.value ? 'GPS 已连接' : state.value.motion.quality === 'lost' ? '定位已中断' : state.value.motion.quality === 'stale' ? '定位更新延迟' : '等待定位信号'))
const motionLabel = computed(() => !fresh.value ? '等待位置' : speed.value < 1 ? '静止' : state.value.motion.accelMps2 > .3 ? '加速' : state.value.motion.accelMps2 < -.3 ? '减速' : '匀速')
const soundLabel = computed(() => busy.value ? `加载声浪 ${state.value.progress}%` : state.value.audioBlocked ? '等待启用声音' : active.value ? state.value.motion.quality === 'lost' ? '定位中断 · 声浪已静音' : state.value.motion.quality === 'none' ? '等待 GPS · 声浪待机' : '声浪已启用' : '声浪已暂停')
const rpmRatio = computed(() => Math.min(1, state.value.engine.rpm / profile.value.config.engine.redlineRpm))

async function automaticStart() {
  if (disposed || document.hidden || manuallyPaused.value || busy.value || active.value) return
  const generation = ++automaticGeneration
  if (state.value.mode !== 'gps') await controller.setMode('gps')
  if (disposed || generation !== automaticGeneration || manuallyPaused.value) return
  await controller.start({ automatic: true })
}
async function activateSound() {
  manuallyPaused.value = false
  if (active.value && state.value.audioBlocked) await controller.resumeSound()
  else if (!active.value && !busy.value) await controller.start()
}
function pause() { manuallyPaused.value = true; ++automaticGeneration; void controller.stop() }
function visibility() { if (!document.hidden) void automaticStart() }
onMounted(() => { document.addEventListener('visibilitychange', visibility); window.addEventListener('pageshow', visibility); void automaticStart() })
onBeforeUnmount(() => { disposed = true; ++automaticGeneration; document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pageshow', visibility) })
</script>

<template>
  <section class="ev-tesla-screen" aria-label="Tesla 车机声浪展示">
    <div class="ev-tesla-grid" aria-hidden="true"/>
    <header class="ev-tesla-topbar">
      <div class="ev-tesla-brand"><UiIcon name="bolt" :size="25"/><div><strong>EV<span>ENGINE</span></strong><small>VIRTUAL POWERTRAIN</small></div></div>
      <div class="ev-tesla-profile"><span>当前声浪</span><strong>{{ profile.name }}</strong></div>
      <button class="ev-tesla-settings" aria-label="返回仪表盘设置" @click="emit('navigate', 'dashboard')"><UiIcon name="settings" :size="20"/><span>设置</span></button>
    </header>

    <div class="ev-tesla-instruments">
      <div class="ev-tesla-speed-dial"><GaugeDial id="tesla-speed" :value="speed" :unknown="!fresh" :max="240" label="GPS 时速" unit="km/h" accent/><span v-if="!fresh" class="ev-tesla-no-speed">{{ gpsLabel }}</span></div>
      <div class="ev-tesla-gear"><span>GEAR</span><strong data-testid="tesla-gear">{{ state.engine.gearLabel }}</strong><small>模拟挡位</small><div class="ev-tesla-motion">{{ motionLabel }}</div></div>
      <GaugeDial id="tesla-rpm" :value="state.engine.rpm" :max="rpmMax" :redline="profile.config.engine.redlineRpm" label="模拟转速" unit="rpm" accent/>
    </div>

    <div class="ev-tesla-rev-strip" aria-label="模拟转速进度"><i v-for="i in 40" :key="i" :class="{ lit: i / 40 <= rpmRatio, redline: i > 34 }"/></div>
    <div class="ev-tesla-telemetry">
      <div><span>加速度</span><strong>{{ fresh ? `${state.motion.accelMps2 > 0 ? '+' : ''}${state.motion.accelMps2.toFixed(2)}` : '—' }}<small>m/s²</small></strong></div>
      <div><span>模拟负载</span><strong>{{ Math.round(state.engine.load * 100) }}<small>%</small></strong></div>
      <div class="ev-tesla-location"><span class="ev-tesla-link" :class="{ connected: fresh }"><i/>{{ gpsLabel }}</span><small>{{ state.motion.ageS === null ? '位置数据仅在本机处理' : `${state.motion.ageS.toFixed(1)} s 前更新` }}</small></div>
    </div>

    <footer class="ev-tesla-bottom">
      <div class="ev-tesla-audio-status"><UiIcon name="volume" :size="17"/><span>{{ soundLabel }}</span><small>音量 {{ state.settings.volume }}% · 强度 {{ state.settings.intensity }}%</small></div>
      <button v-if="state.audioBlocked || !active && !busy" class="ev-tesla-start" :disabled="busy" @click="activateSound"><UiIcon name="bolt" :size="19"/>{{ state.audioBlocked ? '点击启用声浪' : state.status === 'error' ? '重试连接' : '启动声浪' }}</button>
      <button v-else class="ev-tesla-pause" @click="pause"><UiIcon name="stop" :size="16"/>{{ busy ? '取消' : '暂停' }}</button>
    </footer>
    <p v-if="state.error" class="ev-tesla-error" role="alert">{{ state.error }}</p>
  </section>
</template>
