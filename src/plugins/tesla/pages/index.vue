<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from '@fesjs/fes'
import EngineApp from '../components/EngineApp.vue'
import type { PageName } from '../engine/types'

const route = useRoute()
const router = useRouter()
const assetBase = `${import.meta.env.BASE_URL}plugins/tesla/`
const page = computed<PageName>(() => {
    const view = route.query.view
    return view === 'diagnostics' || view === 'tesla' ? view : 'dashboard'
})

function navigate(view: PageName) {
    void router.push({
        path: route.path,
        query: { ...route.query, view: view === 'dashboard' ? undefined : view },
    })
}
</script>

<template>
    <div class="tesla-case">
        <EngineApp :page="page" :asset-base="assetBase" @navigate="navigate" />
    </div>
</template>

<style scoped>
.tesla-case {
    --ev-min-height: 100%;
    --ev-display-height: 100%;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: auto;
}
</style>
