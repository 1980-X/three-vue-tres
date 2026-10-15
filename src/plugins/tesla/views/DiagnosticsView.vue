<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { DiagnosticsController, median } from '../engine/diagnostics'
import { useEngine } from '../composables/engineContext'
import UiIcon from '../components/UiIcon.vue'
import type { PageName } from '../engine/types'

const emit = defineEmits<{ navigate: [page: PageName] }>()
const { state: engineState, controller: engine } = useEngine()
const diagnostic = new DiagnosticsController()
const state = shallowRef({ ...diagnostic.state })
const unsubscribe = diagnostic.subscribe(value => { state.value = value })
const steps = ['浏览器', '声音', '定位', '信号', '结果']
const interval = computed(() => median(state.value.intervals))
const overview = computed(() => state.value.results.some(r => r.status === 'bad') ? { title: '还有几项需要检查', text: '查看下方结果，修正后可重新测试。', status: 'bad' } : state.value.results.some(r => r.status === 'warn') ? { title: '基础可用，建议实车确认', text: '部分检测项需要进一步确认，先查看具体说明。', status: 'warn' } : { title: '已具备联动体验的基础条件', text: '接下来可进入仪表盘，在实车上验证声浪响应。', status: 'ok' })
const source = computed(() => state.value.motion.source === 'gps' ? '设备速度' : state.value.motion.source === 'derived' ? '位置差估算' : '尚无数据')
function exportReport() {
  const blob = new Blob([JSON.stringify(diagnostic.report(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = `ev-engine-diagnostic-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function handleVisibility() { if (document.hidden) diagnostic.pause() }
onMounted(() => document.addEventListener('visibilitychange', handleVisibility))
onBeforeUnmount(() => { unsubscribe(); diagnostic.dispose(); document.removeEventListener('visibilitychange', handleVisibility) })
</script>

<template>
  <section class="ev-page-intro">
    <div><div class="ev-eyebrow"><span/> COMPATIBILITY & DIAGNOSTICS</div><h1>兼容性诊断<span>先确认连接，再享受声浪。</span></h1></div>
    <button class="ev-button ev-button-quiet" @click="diagnostic.reset()"><UiIcon name="refresh" :size="16"/>重新检测</button>
  </section>
  <div class="ev-diagnostic-grid">
    <div class="ev-diagnostic-main ev-panel">
      <ol class="ev-stepper" aria-label="诊断步骤"><li v-for="(name, index) in steps" :key="name" :class="{ active: state.step === index, complete: state.step > index }" :aria-current="state.step === index ? 'step' : undefined"><span><UiIcon v-if="state.step > index" name="check" :size="14"/><template v-else>{{ index === 4 ? '✓' : index + 1 }}</template></span><strong>{{ name }}</strong></li></ol>

      <div v-if="state.error" class="ev-alert ev-alert-error" role="alert"><UiIcon name="warning" :size="18"/><span>{{ state.error }}</span></div>

      <section v-if="state.step === 0" class="ev-diagnostic-step">
        <div class="ev-step-kicker">STEP 01 / BROWSER</div><h2>你的浏览器，准备好了吗？</h2><p class="ev-step-description">检查定位、音频与页面运行能力。建议直接在 Tesla 车载浏览器中测试。</p>
        <div class="ev-capabilities"><div v-for="capability in state.capabilities" :key="capability.id" class="ev-capability"><div class="ev-capability-icon" :class="{ available: capability.available }"><UiIcon :name="capability.id === 'geo' ? 'gps' : capability.id === 'audio' ? 'volume' : capability.id === 'secure' ? 'check' : 'activity'" :size="19"/></div><div><strong>{{ capability.label }}</strong><small>{{ capability.detail }}</small></div><span class="ev-capability-result" :class="{ available: capability.available, optional: !capability.required }">{{ capability.available ? '可用' : capability.required ? '不可用' : '未提供' }}<UiIcon :name="capability.available ? 'check' : 'info'" :size="14"/></span></div></div>
        <div class="ev-diagnostic-step-footer"><span><UiIcon name="clock" :size="14"/>约需 1 分钟</span><button class="ev-button ev-button-primary" @click="diagnostic.next()">继续声音测试<UiIcon name="arrow" :size="16"/></button></div>
      </section>

      <section v-else-if="state.step === 1" class="ev-diagnostic-step ev-step-centered">
        <div class="ev-step-kicker">STEP 02 / AUDIO</div><h2>听听，声音有没有到达。</h2><p class="ev-step-description">稍微调高车内媒体音量，点击下方按钮。正常情况下会听到两声短提示音。</p>
        <div class="ev-sound-test-visual" :class="{ playing: state.audioPlaying }"><i/><i/><i/><i/><i/><i/><i/><UiIcon name="volume" :size="34"/></div>
        <button class="ev-button ev-button-primary" :disabled="state.audioPlaying" @click="diagnostic.playSound()"><UiIcon :name="state.audioPlaying ? 'activity' : 'play'" :size="18"/>{{ state.audioPlaying ? '提示音播放中' : '播放测试音' }}</button>
        <div class="ev-heard-question"><p>听到两声提示音了吗？</p><div><button class="ev-button ev-button-secondary" :disabled="state.sampleRate === null" @click="diagnostic.confirmAudio(true)"><UiIcon name="check" :size="16"/>听到了</button><button class="ev-button ev-button-quiet" @click="diagnostic.confirmAudio(false)">没有听到</button></div></div>
        <div v-if="state.audioHeard === false" class="ev-audio-help"><p>检查方向盘或屏幕的媒体音量、静音状态，以及当前媒体音源。可以暂时暂停其他音乐再试一次。</p><button class="ev-text-button" @click="diagnostic.next()">先继续定位测试<UiIcon name="arrow" :size="14"/></button></div>
      </section>

      <section v-else-if="state.step === 2" class="ev-diagnostic-step ev-step-centered">
        <div class="ev-step-kicker">STEP 03 / LOCATION</div><h2>连接位置，让声浪跟上你。</h2><p class="ev-step-description">浏览器需要位置权限来获取速度。位置与路线仅在设备内处理，不会上传。</p>
        <div class="ev-location-visual" :class="{ searching: state.running }"><span/><span/><UiIcon name="gps" :size="48"/></div>
        <button class="ev-button ev-button-primary" :disabled="state.running" @click="diagnostic.startLocation(engineState.settings.processingMode)"><UiIcon :name="state.running ? 'loader' : 'gps'" :size="18"/>{{ state.running ? '等待授权与定位信号…' : '允许定位并开始测试' }}</button>
        <p class="ev-location-note">{{ state.running ? '请在浏览器提示中选择允许，并保持页面可见。' : '请先驻车，尽量选择信号良好的开阔区域。' }}</p>
        <button v-if="!state.running" class="ev-text-button ev-location-skip" @click="diagnostic.finish()">跳过定位，查看当前结果<UiIcon name="arrow" :size="14"/></button>
      </section>

      <section v-else-if="state.step === 3" class="ev-diagnostic-step ev-step-centered">
        <div class="ev-step-kicker">STEP 04 / SIGNAL</div><h2>正在测量定位信号。</h2><p class="ev-step-description">持续观察更新间隔与精度，并比较补充查询是否带来新的位置样本。</p>
        <div class="ev-countdown"><strong class="ev-mono">{{ state.remaining }}</strong><span>秒后完成</span><svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="82" class="ev-countdown-track"/><circle cx="90" cy="90" r="82" class="ev-countdown-progress" :style="{ strokeDashoffset: 515.22 * (1 - state.progress / 100) }"/></svg></div>
        <div class="ev-signal-test-values"><div><strong>{{ state.stats.received }}</strong><span>收到的测量</span></div><div><strong>{{ state.bestAccuracy === null ? '—' : `±${Math.round(state.bestAccuracy)}` }}<small v-if="state.bestAccuracy !== null">m</small></strong><span>最佳位置精度</span></div><div><strong>{{ interval === null ? '—' : (interval / 1000).toFixed(2) }}<small v-if="interval !== null">s</small></strong><span>更新间隔中位数</span></div></div>
        <p class="ev-location-note">请保持页面可见，检测完成后会自动显示结果。</p>
        <button class="ev-text-button" @click="diagnostic.finish()">提前结束，查看结果<UiIcon name="arrow" :size="14"/></button>
      </section>

      <section v-else class="ev-diagnostic-step">
        <div class="ev-result-header" :class="`result-${overview.status}`"><div><UiIcon :name="overview.status === 'ok' ? 'check' : 'info'" :size="27"/></div><section><div class="ev-step-kicker">DIAGNOSTIC RESULT</div><h2>{{ overview.title }}</h2><p>{{ overview.text }}</p></section></div>
        <div class="ev-results"><div v-for="result in state.results" :key="result.label" class="ev-result-row"><span class="ev-result-dot" :class="`result-${result.status}`"><UiIcon :name="result.status === 'ok' ? 'check' : 'warning'" :size="15"/></span><div><strong>{{ result.label }}</strong><p>{{ result.detail }}</p></div><span class="ev-result-tag" :class="`result-${result.status}`">{{ result.status === 'ok' ? '通过' : result.status === 'warn' ? '需确认' : '需检查' }}</span></div></div>
        <div class="ev-diagnostic-step-footer"><button class="ev-button ev-button-quiet" @click="exportReport"><UiIcon name="download" :size="16"/>导出诊断结果</button><button class="ev-button ev-button-primary" @click="emit('navigate', 'dashboard')">进入仪表盘<UiIcon name="arrow" :size="16"/></button></div>
      </section>
    </div>

    <aside class="ev-diagnostic-sidebar">
      <section class="ev-panel ev-readings"><div class="ev-section-heading"><h2><UiIcon name="activity" :size="18"/>实时读数</h2><span class="ev-dot" :class="{ 'is-on': state.running }"/></div><dl><div><dt>当前速度</dt><dd>{{ (state.motion.speedMps * 3.6).toFixed(1) }}<small>km/h</small></dd></div><div><dt>估算加速度</dt><dd>{{ state.motion.accelMps2.toFixed(2) }}<small>m/s²</small></dd></div><div><dt>速度来源</dt><dd class="ev-reading-text">{{ source }}</dd></div><div><dt>位置精度</dt><dd>{{ state.motion.accuracyM === null ? '—' : `±${Math.round(state.motion.accuracyM)}` }}<small v-if="state.motion.accuracyM !== null">m</small></dd></div><div><dt>有效 / 全部测量</dt><dd>{{ state.stats.accepted }}<span> / {{ state.stats.received }}</span></dd></div><div><dt>已过滤测量</dt><dd>{{ state.stats.rejected }}</dd></div><div><dt>更新间隔 · 中位数</dt><dd>{{ interval === null ? '—' : (interval / 1000).toFixed(2) }}<small v-if="interval !== null">s</small></dd></div><div><dt>音频采样率</dt><dd>{{ state.sampleRate ? (state.sampleRate / 1000).toFixed(1) : '—' }}<small v-if="state.sampleRate">kHz</small></dd></div><div><dt>音频基础延迟</dt><dd>{{ state.baseLatency === null ? '—' : (state.baseLatency * 1000).toFixed(1) }}<small v-if="state.baseLatency !== null">ms</small></dd></div></dl></section>
      <section class="ev-panel ev-diagnostic-note"><div class="ev-note-icon"><UiIcon name="car" :size="22"/></div><h3>在车里，测得更准确。</h3><p>电脑可能只能提供 Wi-Fi 定位，精度和更新频率与车机不同。完整结果需要在目标 Model 3 / Y 上确认。</p><div><UiIcon name="check" :size="14"/>无需账号 · 结果仅在本机</div></section>
    </aside>
  </div>

  <details class="ev-panel ev-technical-details"><summary><span><UiIcon name="settings" :size="17"/>技术详情</span><span class="ev-small ev-muted">定位参数与本地日志<UiIcon name="chevron" :size="15"/></span></summary><div class="ev-details-content"><div class="ev-diagnostic-settings"><label>速度响应<select :value="engineState.settings.processingMode" :disabled="state.running" @change="engine.applySettings({ processingMode: ($event.target as HTMLSelectElement).value === 'adaptive' ? 'adaptive' : 'smooth' })"><option value="smooth">平滑 · 原站基础默认</option><option value="adaptive">自适应 · 原站内置预测</option></select></label><label>驾驶页补充查询<select :value="engineState.settings.pollMs" :disabled="state.running" @change="engine.applySettings({ pollMs: Number(($event.target as HTMLSelectElement).value) })"><option :value="0">关闭 · 仅监听位置变化</option><option :value="250">250 ms · 补充查询</option></select></label></div><div class="ev-technical-values"><span>精度阈值 <strong>50 m</strong></span><span>数据过期 <strong>3.5 s</strong></span><span>定位丢失 <strong>8 s</strong></span><span>监听独立样本 <strong>{{ state.watchUnique }}</strong></span><span>查询独立样本 <strong>{{ state.pollUnique }}</strong></span><span>查询额外样本 <strong>{{ state.pollAdditional }}</strong></span></div><p class="ev-small ev-muted">补充查询不保证提高设备定位频率。重复结果会由原站的估算器过滤。</p><div class="ev-log" aria-label="本地诊断日志"><p v-if="!state.logs.length">等待测试开始。</p><div v-for="entry in state.logs" :key="entry.id" :class="`log-${entry.level}`"><time>{{ entry.time }}</time><span>{{ entry.message }}</span></div></div></div></details>
  <div class="ev-page-footnote"><UiIcon name="info" :size="14"/><span>诊断仅检查浏览器能力、声音确认与定位质量，不代表已通过实车验证。</span></div>
</template>
