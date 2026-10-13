<!-- 保留旧入口，两种入口共用配置加载、预览与清理逻辑。 -->
<template>
    <goViewCom v-bind="$attrs" />
</template>

<script setup lang="ts">
import goViewCom from './goViewCom.vue'
defineOptions({ inheritAttrs: false })
</script>
