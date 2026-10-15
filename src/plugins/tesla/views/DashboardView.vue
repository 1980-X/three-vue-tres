<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useEngine } from '../composables/engineContext'
import GaugeDial from '../components/GaugeDial.vue'
import SignalWave from '../components/SignalWave.vue'
import UiIcon from '../components/UiIcon.vue'

const { state, controller, profiles } = useEngine()
const filter = ref('all')
const holdThrottle = ref(0)
const profile = computed(() => profiles.find(p => p.id === state.value.profileId)!)
const visibleProfiles = computed(() => profiles.filter(p => filter.value === 'all' || p.config.source === filter.value))
const active = computed(() => state.value.status === 'running' || state.value.status === 'switching')
const busy = computed(() => ['starting', 'switching'].includes(state.value.status))
const speed = computed(() => state.value.motion.speedMps * 3.6)
const rpmMax = computed(() => Math.ceil((profile.value.config.engine.limiterRpm || profile.value.config.engine.redlineRpm) / 1000) * 1000)
const statusLabel = computed(() => ({ off: '等待启动', starting: '准备声浪', running: '引擎运行中', switching: '切换音色', paused: '已暂停', error: '需要检查' })[state.value.status])
const gpsLabel = computed(() => state.value.mode === 'demo' ? '模拟输入' : ({ none: state.value.gpsStatus === 'requesting' ? '等待定位授权' : '等待定位', fresh: '定位已连接', stale: '定位更新延迟', lost: '定位已中断', demo: '模拟输入' })[state.value.motion.quality])
const phaseNames = ['怠速暖机', '加速至 150 km/h', '减速至 80 km/h', '降挡加速至 160 km/h', '减速至 50 km/h']
const sourceLabel = computed(() => state.value.motion.source === 'gps' ? '设备速度' : state.value.motion.source === 'derived' ? '位置差估算' : state.value.mode === 'demo' ? '演示数据' : '尚无数据')
const elapsed = computed(() => `${String(Math.floor(state.value.elapsedS / 60)).padStart(2, '0')}:${String(Math.floor(state.value.elapsedS % 60)).padStart(2, '0')}`)
function pedal(event: PointerEvent, which: 'gas' | 'brake', held: boolean) {
  if (held) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  which === 'gas' ? controller.setGas(held) : controller.setBrake(held)
}
function keydown(event: KeyboardEvent) {
  if (!active.value || state.value.mode !== 'demo' || state.value.demoMode !== 'manual') return
  const target = event.target as HTMLElement
  if (target.isContentEditable || target.matches('input, select, textarea, button')) return
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault()
  if (event.code === 'Space' || event.code === 'ArrowUp') controller.setGas(true)
  if (event.code === 'ArrowDown') controller.setBrake(true)
}
function keyup(event: KeyboardEvent) {
  if (event.code === 'Space' || event.code === 'ArrowUp') controller.setGas(false)
  if (event.code === 'ArrowDown') controller.setBrake(false)
}
function release() { controller.releasePedals() }
function setThrottle(value: number) { holdThrottle.value = value; controller.setHoldThrottle(value) }
onMounted(() => window.addEventListener('blur', release))
onBeforeUnmount(() => { window.removeEventListener('blur', release); release() })
</script>

<template>
  <div class="ev-dashboard" tabindex="0" @keydown="keydown" @keyup="keyup" @focusout="release">
  <section class="ev-page-intro">
    <div><div class="ev-eyebrow"><span/> ELECTRIC DRIVE. ENGINE SOUL.</div><h1>驾驶仪表盘<span>让每一次加速，都有回应。</span></h1></div>
    <div class="ev-session"><UiIcon name="clock" :size="16"/><span class="ev-mono">{{ elapsed }}</span><span class="ev-session-divider"/><span>{{ state.mode === 'gps' ? 'GPS 驾驶' : '桌面演示' }}</span></div>
  </section>

  <div v-if="state.error" class="ev-alert ev-alert-error" role="alert"><UiIcon name="warning"/><span>{{ state.error }}</span></div>
  <div v-else-if="state.notice" class="ev-alert" role="status"><UiIcon name="info"/><span>{{ state.notice }}</span></div>

  <div class="ev-dashboard-grid">
    <section class="ev-instrument-panel ev-panel">
      <div class="ev-panel-heading">
        <div class="ev-current-engine"><img :src="profile.image" alt=""/><div><span class="ev-muted ev-small">当前引擎</span><h2>{{ profile.name }}</h2></div></div>
        <span class="ev-status-pill" :class="{ 'is-connected': state.motion.quality === 'fresh' || state.mode === 'demo', 'is-warning': ['stale', 'lost'].includes(state.motion.quality) }"><UiIcon :name="state.mode === 'gps' ? 'gps' : 'activity'" :size="14"/>{{ gpsLabel }}</span>
      </div>
      <div class="ev-dials">
        <GaugeDial id="speed" :value="speed" :max="240" label="当前速度" unit="km/h"/>
        <div class="ev-gear"><span>GEAR</span><strong data-testid="gear">{{ state.engine.gearLabel }}</strong><small>{{ state.engine.shifting ? state.engine.shiftDir === 'up' ? '升挡中' : '降挡中' : '自动变速' }}</small></div>
        <GaugeDial id="rpm" :value="state.engine.rpm" :max="rpmMax" :redline="profile.config.engine.redlineRpm" label="模拟转速" unit="rpm" accent/>
      </div>
      <div class="ev-live-values">
        <div><span>加速度</span><strong data-testid="acceleration">{{ state.motion.accelMps2 > 0 ? '+' : '' }}{{ state.motion.accelMps2.toFixed(2) }}<small>m/s²</small></strong></div>
        <div><span>模拟负载</span><strong>{{ Math.round(state.engine.load * 100) }}<small>%</small></strong><div class="ev-tiny-meter"><i :style="{ width: `${Math.abs(state.engine.load) * 100}%` }"/></div></div>
        <div><span>最高速度</span><strong>{{ Math.round(state.maxSpeedKmh) }}<small>km/h</small></strong></div>
        <div><span>数据来源</span><strong class="ev-source-value">{{ sourceLabel }}</strong><small class="ev-value-footnote">{{ state.mode === 'demo' ? '与真实车辆无关' : state.motion.ageS === null ? '等待首个样本' : `${state.motion.ageS.toFixed(1)} s 前更新` }}</small></div>
      </div>
      <SignalWave :samples="state.waveform" :level="state.level" :active="active"/>
    </section>

    <aside class="ev-control-panel ev-panel">
      <div class="ev-section-heading"><h2><UiIcon name="settings" :size="18"/>声浪控制</h2><span class="ev-small ev-muted">本地保存</span></div>
      <div class="ev-segmented ev-mode-switch" aria-label="输入模式">
        <button :class="{ active: state.mode === 'gps' }" :disabled="busy" :aria-pressed="state.mode === 'gps'" @click="controller.setMode('gps')"><UiIcon name="gps" :size="15"/>GPS 驾驶</button>
        <button :class="{ active: state.mode === 'demo' }" :disabled="busy" :aria-pressed="state.mode === 'demo'" @click="controller.setMode('demo')"><UiIcon name="play" :size="14"/>桌面演示</button>
      </div>
      <div class="ev-control-description">{{ state.mode === 'gps' ? '根据定位速度，模拟转速、挡位与负载。' : '用模拟输入，在电脑上体验加速和换挡。' }}</div>
      <div class="ev-slider-control"><label for="engine-volume"><span><UiIcon name="volume" :size="16"/>音量</span><strong class="ev-mono">{{ state.settings.volume }}<small>%</small></strong></label><input id="engine-volume" type="range" min="0" max="100" :value="state.settings.volume" :style="{ '--range-value': `${state.settings.volume}%` }" @input="controller.applySettings({ volume: Number(($event.target as HTMLInputElement).value) })"/></div>
      <div class="ev-slider-control"><label for="engine-intensity"><span><UiIcon name="bolt" :size="16"/>声浪强度</span><strong class="ev-mono">{{ state.settings.intensity }}<small>%</small></strong></label><input id="engine-intensity" type="range" min="0" max="100" :value="state.settings.intensity" :style="{ '--range-value': `${state.settings.intensity}%` }" @input="controller.applySettings({ intensity: Number(($event.target as HTMLInputElement).value) })"/></div>
      <label class="ev-toggle-row"><span>换挡音效<small>升挡切断与降挡补油</small></span><input type="checkbox" role="switch" :checked="state.settings.shiftSounds" @change="controller.applySettings({ shiftSounds: ($event.target as HTMLInputElement).checked })"/><i/></label>
      <div class="ev-engine-specs"><span>{{ profile.config.engine.cylinders ? `${profile.config.engine.cylinders} 缸引擎` : '未来感涡轮' }}</span><span>{{ profile.config.gearbox.ratios.length }} 挡模拟</span><span>{{ profile.config.source === 'samples' ? '采样音色' : '合成音色' }}</span></div>
      <button class="ev-ignition" :class="{ 'is-running': active, 'is-loading': busy }" :aria-busy="busy" data-testid="ignition" @click="active || busy ? controller.stop() : controller.start()"><UiIcon :name="busy ? 'loader' : active ? 'stop' : 'bolt'" :size="21"/><span>{{ busy ? `准备中 ${state.progress}% · 点击取消` : active ? '停止引擎' : '启动引擎' }}</span></button>
      <div class="ev-ignition-status"><span class="ev-dot" :class="{ 'is-on': active }"/>{{ statusLabel }}<span class="ev-mono">{{ active ? 'ENGINE ON' : 'ENGINE OFF' }}</span></div>
    </aside>
  </div>

  <section v-if="state.mode === 'demo'" class="ev-demo-panel ev-panel">
    <div class="ev-demo-title"><span class="ev-demo-badge">DEMO</span><div><h2>桌面试驾</h2><p>{{ state.demoMode === 'auto' && active ? phaseNames[state.demoPhase] : '按住加速或制动，听转速与挡位的变化。' }}</p></div></div>
    <div class="ev-segmented ev-demo-mode"><button :class="{ active: state.demoMode === 'manual' }" @click="controller.setDemoMode('manual')">手动控制</button><button :class="{ active: state.demoMode === 'auto' }" @click="controller.setDemoMode('auto')">自动巡演</button></div>
    <div v-if="state.demoMode === 'manual'" class="ev-pedals">
      <button class="ev-pedal ev-brake" :class="{ pressed: state.engine.brake > .1 }" :disabled="!active" @pointerdown.prevent="pedal($event, 'brake', true)" @pointerup="pedal($event, 'brake', false)" @pointercancel="release" @lostpointercapture="release" @keydown.space.prevent="controller.setBrake(true)" @keyup.space.prevent="controller.setBrake(false)" @blur="release"><UiIcon name="arrowDown" :size="17"/>制动<kbd>↓</kbd></button>
      <button class="ev-pedal ev-gas" :class="{ pressed: state.engine.throttle > .3 }" :disabled="!active" data-testid="accelerate" @pointerdown.prevent="pedal($event, 'gas', true)" @pointerup="pedal($event, 'gas', false)" @pointercancel="release" @lostpointercapture="release" @keydown.space.prevent="controller.setGas(true)" @keyup.space.prevent="controller.setGas(false)" @blur="release"><UiIcon name="arrowUp" :size="17"/>加速<kbd>↑ / 空格</kbd></button>
      <label class="ev-hold-throttle">持续负载 <span>{{ holdThrottle }}%</span><input type="range" min="0" max="100" :value="holdThrottle" :disabled="!active" @input="setThrottle(Number(($event.target as HTMLInputElement).value))"/></label>
    </div>
    <p v-else class="ev-auto-note"><UiIcon name="activity" :size="16"/>{{ active ? '自动循环：起步、升挡、减速、降挡加速。' : '启动引擎后，自动演示完整的转速和换挡过程。' }}</p>
  </section>

  <section class="ev-sound-library">
    <div class="ev-library-heading"><div><span class="ev-eyebrow">SOUND COLLECTION</span><h2>选择你的声浪 <span>{{ profiles.length }} 款引擎</span></h2></div><div class="ev-filter-group" aria-label="音色筛选"><button v-for="option in [{ id: 'all', label: '全部' }, { id: 'synth', label: '合成' }, { id: 'samples', label: '采样' }]" :key="option.id" :class="{ active: filter === option.id }" :aria-pressed="filter === option.id" @click="filter = option.id">{{ option.label }}</button></div></div>
    <div class="ev-profile-grid">
      <button v-for="sound in visibleProfiles" :key="sound.id" class="ev-profile-card" :class="{ selected: sound.id === state.profileId }" :disabled="busy" :aria-pressed="sound.id === state.profileId" @click="controller.selectProfile(sound.id)">
        <div class="ev-profile-image"><img :src="sound.image" :alt="sound.name" loading="lazy"/><span class="ev-profile-type">{{ sound.config.source === 'samples' ? 'SAMPLE' : 'SYNTH' }}</span><span v-if="sound.id === state.profileId" class="ev-profile-check"><UiIcon name="check" :size="14"/></span></div>
        <div class="ev-profile-caption"><strong>{{ sound.name }}</strong><span>{{ sound.config.engine.cylinders ? `${sound.config.engine.cylinders} 缸` : '涡轮' }}<i/>{{ sound.config.gearbox.ratios.length }} 挡<UiIcon v-if="sound.id === state.profileId && active" name="volume" :size="13"/></span></div>
      </button>
    </div>
  </section>
  <div class="ev-page-footnote"><UiIcon name="info" :size="14"/><span>转速、挡位与负载均为模拟值。驻车完成设置，行驶中保持音量适当。</span><span class="ev-footnote-right">{{ state.mode === 'gps' ? '位置数据仅在本机计算' : '当前为演示模式' }}</span></div>
  </div>
</template>
