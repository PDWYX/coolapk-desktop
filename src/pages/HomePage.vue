<template>
  <!-- 布局变化只更新展示参数，保留栏目页、分页游标和滚动容器。 -->
  <MobileHomePager :mobile="mobile" />
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import MobileHomePager from '../components/feed/MobileHomePager.vue';
import { useSettingsStore } from '../stores/settings';
import { isTouchMobilePlatform } from '../utils/platform';
import { addMediaQueryListener } from '../utils/mediaQuery';
const settings = useSettingsStore();
const narrow = ref(window.matchMedia('(max-width: 720px)').matches);
const mobile = computed(() => narrow.value && (isTouchMobilePlatform() || !settings.settings.disableAutoMobileMode));
const media = window.matchMedia('(max-width: 720px)');
function resize() { narrow.value = media.matches; }
// iOS 13 的 MediaQueryList 只有已废弃的 addListener，addEventListener 要 Safari 14 才有，
// 直接调用会在进入首页时抛 TypeError，这里统一走兼容封装。
let stopMediaListener: (() => void) | null = null;
onMounted(() => { stopMediaListener = addMediaQueryListener(media, resize); });
onUnmounted(() => { stopMediaListener?.(); stopMediaListener = null; });
</script>
