<script setup lang="ts">
import { computed, defineAsyncComponent, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { createEngineContext } from '../composables/engineContext'
import DashboardView from '../views/DashboardView.vue'
import DiagnosticsView from '../views/DiagnosticsView.vue'
import TeslaView from '../views/TeslaView.vue'
import UiIcon from './UiIcon.vue'
import type { PageName } from '../engine/types'
import '../styles.css'

const props = withDefaults(defineProps<{ assetBase?: string; page?: PageName; storageKey?: string }>(), { assetBase: './plugins/tesla/', page: 'dashboard' })
const emit = defineEmits<{ navigate: [page: PageName] }>()
const { controller } = createEngineContext(props.assetBase, props.storageKey)
const Tesla3DView = defineAsyncComponent(() => import('../views/Tesla3DView.vue'))
const isActive = ref(true)
const isDisplay = computed(() => props.page === 'tesla' || props.page === 'tesla3d')
watch(() => props.page, () => { void controller.stop() }, { flush: 'sync' })
async function navigate(page: PageName) { if (page === props.page) return; await controller.stop(); emit('navigate', page) }
function visibility() { if (document.hidden) controller.pauseForVisibility() }
function freeze() { controller.pauseForVisibility() }
function listen() { document.addEventListener('visibilitychange', visibility); document.addEventListener('freeze', freeze); window.addEventListener('pagehide', freeze) }
function unlisten() { document.removeEventListener('visibilitychange', visibility); document.removeEventListener('freeze', freeze); window.removeEventListener('pagehide', freeze) }
onMounted(listen)
onActivated(() => { isActive.value = true; listen() })
onDeactivated(() => { isActive.value = false; unlisten(); void controller.stop() })
onBeforeUnmount(unlisten)
defineExpose({ start: () => controller.start(), stop: () => controller.stop(), setProfile: (id: number) => controller.selectProfile(id), setMode: controller.setMode.bind(controller), applySettings: controller.applySettings.bind(controller), getState: () => controller.state })
</script>

<template>
  <div class="tesla-engine ev-app" :class="{ 'ev-app-display': isDisplay }">
    <header v-if="!isDisplay" class="ev-header">
      <div class="ev-header-inner">
        <button class="ev-brand" aria-label="EV Engine 仪表盘" @click="navigate('dashboard')"><span class="ev-brand-mark"><UiIcon name="bolt" :size="22"/></span><span>EV<span class="ev-brand-light">ENGINE</span><small>VIRTUAL ENGINE SOUND</small></span></button>
        <nav class="ev-nav" aria-label="主要导航">
          <button :class="{ active: page === 'dashboard' }" :aria-current="page === 'dashboard' ? 'page' : undefined" @click="navigate('dashboard')"><UiIcon name="gauge" :size="17"/>仪表盘</button>
          <button :class="{ active: page === 'diagnostics' }" :aria-current="page === 'diagnostics' ? 'page' : undefined" @click="navigate('diagnostics')"><UiIcon name="activity" :size="17"/>诊断</button>
        </nav>
        <div class="ev-display-entries">
          <button class="ev-vehicle-tag ev-display-entry" @click="navigate('tesla')"><UiIcon name="car" :size="16"/>二维车机</button>
          <button class="ev-vehicle-tag ev-display-entry" @click="navigate('tesla3d')"><UiIcon name="car" :size="16"/>三维车机<UiIcon name="arrow" :size="14"/></button>
        </div>
      </div>
    </header>
    <main class="ev-main" :class="{ 'ev-main-display': isDisplay }">
      <template v-if="isActive">
        <DashboardView v-if="page === 'dashboard'"/>
        <TeslaView v-else-if="page === 'tesla'" @navigate="navigate"/>
        <Tesla3DView v-else-if="page === 'tesla3d'" @navigate="navigate"/>
        <DiagnosticsView v-else @navigate="navigate"/>
      </template>
    </main>
    <footer v-if="!isDisplay" class="ev-footer"><span>EV ENGINE<span class="ev-footer-separator">/</span>浏览器声浪实验室</span><span>位置本地计算 · 设置本地保存</span></footer>
  </div>
</template>

<style scoped>
.tesla-engine {
  width: 100%;
  min-width: 0;
  color-scheme: dark;
  text-align: left;
  isolation: isolate;
}
</style>
