// 波点装饰簇
<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import SketchDot from './SketchDot.vue'

interface DotMeta {
  x: number
  y: number
  svgSize: number
  dotSize: number
  hollow: boolean
  opacity: number
  phase: number
  cycleTime: number    // 单次衰减弹跳生命周期 ms
  amplitude: number    // 最大弹跳高度 px
  damp: number         // 衰减强度
  offsetY: number
}

const props = defineProps({
  fullscreen: {
    type: Boolean,
    default: false
  },
  count: {
    type: Number,
    default: 26
  },
  baseSvgSize: {
    type: Number,
    default: 30
  },
  baseDotRadius: {
    type: Number,
    default: 8
  },
  spread: {
    type: Number,
    default: 100
  },
  safeInset: {
    type: Number,
    default: 45
  },
  hollowRatio: {
    type: Number,
    default: 0.35
  },
  minOpacity: {
    type: Number,
    default: 0.35
  },
  maxOpacity: {
    type: Number,
    default: 0.85
  },
  enableBounce: {
    type: Boolean,
    default: true
  },
  maxAmp: {
    type: Number,
    default: 12
  },
  minAmp: {
    type: Number,
    default: 3
  },
  dampMin: {
    type: Number,
    default: 0.3
  },
  dampMax: {
    type: Number,
    default: 0.6
  },
  cycleMin: {
    type: Number,
    default: 2200
  },
  cycleMax: {
    type: Number,
    default: 4000
  },
  debounceDelay: {
    type: Number,
    default: 150
  }
})

const dotList = ref<DotMeta[]>([])
const containerRef = ref<HTMLDivElement | null>(null)
let rafId: number | null = null
let debounceTimer: number | null = null

function debounceRefresh() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = window.setTimeout(() => {
    nextTick(generateDots)
  }, props.debounceDelay)
}

/**
 * 确定性环形生成：在容器四周的安全环带内均匀取点 + 固定幅度抖动
 * 替代原来的拒绝采样（do-while），数学上不可能死循环
 */
function generateDots() {
  if (!containerRef.value) return
  const dom = containerRef.value
  const rect = props.fullscreen
    ? { width: window.innerWidth, height: window.innerHeight }
    : dom.getBoundingClientRect()

  const { safeInset, spread, count } = props
  const w = rect.width + spread * 2
  const h = rect.height + spread * 2

  // 参数非法（安全区反转）时直接返回空，不进入生成逻辑
  if (safeInset * 2 >= rect.width || safeInset * 2 >= rect.height) {
    dotList.value = []
    return
  }

  const dots: DotMeta[] = []
  // 环带周长（上、右、下、左四条边），按边长比例分配点数
  const topW = w
  const sideH = h - safeInset * 2
  const totalPerimeter = topW * 2 + sideH * 2
  const perEdge = [
    Math.round(count * topW / totalPerimeter),      // 上
    Math.round(count * sideH / totalPerimeter),     // 右
    Math.round(count * topW / totalPerimeter),      // 下
    Math.round(count * sideH / totalPerimeter),     // 左
  ]

  const edges: Array<{ x0: number; y0: number; x1: number; y1: number }> = [
    { x0: -spread, y0: -spread, x1: w - spread, y1: safeInset },          // 上
    { x0: w - spread - safeInset, y0: safeInset, x1: w - spread, y1: h - spread - safeInset }, // 右
    { x0: -spread, y0: h - spread - safeInset, x1: w - spread, y1: h - spread }, // 下
    { x0: -spread, y0: safeInset, x1: safeInset, y1: h - spread - safeInset }, // 左
  ]

  for (let e = 0; e < 4; e++) {
    const edge = edges[e]
    const n = perEdge[e]
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n  // 均匀分布，中心对齐
      const jx = (Math.random() - 0.5) * 0.6  // ±30% 抖动
      const jy = (Math.random() - 0.5) * 0.6
      const x = edge.x0 + (edge.x1 - edge.x0) * (t + jx)
      const y = edge.y0 + (edge.y1 - edge.y0) * (t + jy)

      const scale = 0.5 + Math.random() * 0.9
      const isHollow = Math.random() < props.hollowRatio
      dots.push({
        x,
        y,
        svgSize: props.baseSvgSize * scale,
        dotSize: props.baseDotRadius * scale,
        hollow: isHollow,
        opacity: props.minOpacity + Math.random() * (props.maxOpacity - props.minOpacity),
        phase: Math.random(),
        cycleTime: props.cycleMin + Math.random() * (props.cycleMax - props.cycleMin),
        amplitude: props.minAmp + Math.random() * (props.maxAmp - props.minAmp),
        damp: props.dampMin + Math.random() * (props.dampMax - props.dampMin),
        offsetY: 0
      })
    }
  }
  dotList.value = dots
}

/**
 * 无限连续阻尼振动：
 * localT 0~1 当前生命周期进度，走完自动回到0，无缝接续，不重置全局时间
 */
function calcInfiniteOsc(localT: number, amp: number, damp: number): number {
  // 生命周期内指数衰减
  const decay = Math.exp(-damp * localT * 4)
  const wave = Math.sin(localT * Math.PI * 6)
  return amp * decay * wave
}

function animate(time: number) {
  // 页面不可见时暂停，省电省 CPU
  if (document.hidden) {
    rafId = requestAnimationFrame(animate)
    return
  }
  if (!props.enableBounce) {
    rafId = null
    return
  }
  dotList.value.forEach(dot => {
    // 基于 performance.now 真实时间，永不归零
    const localT = ((time / dot.cycleTime) + dot.phase) % 1
    dot.offsetY = calcInfiniteOsc(localT, dot.amplitude, dot.damp)
  })
  rafId = requestAnimationFrame(animate)
}

function onResize() {
  debounceRefresh()
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(generateDots)
  window.addEventListener('resize', onResize)

  resizeObserver = new ResizeObserver(() => {
    debounceRefresh()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  if (props.enableBounce) {
    rafId = requestAnimationFrame(animate)
  }
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  window.removeEventListener('resize', onResize)
  if (resizeObserver) resizeObserver.disconnect()
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null  // 置回 null，防止 watch 里误判
  }
})

watch(() => [props.count, props.fullscreen, props.enableBounce], () => {
  nextTick(() => {
    generateDots()
    if (props.enableBounce && !rafId) {
      rafId = requestAnimationFrame(animate)
    }
  })
})
</script>

<template>
  <div
    ref="containerRef"
    class="absolute inset-0 overflow-hidden pointer-events-none text-sketch-line"
    style="z-index:-1;"
  >
    <SketchDot
      v-for="(dot, idx) in dotList"
      :key="idx"
      :size="dot.svgSize"
      :dot-size="dot.dotSize"
      :hollow="dot.hollow"
      className="absolute"
      :style="{
        left: `${dot.x}px`,
        top: `${dot.y + dot.offsetY}px`,
        opacity: dot.opacity,
        transform: 'translateZ(0)',
        willChange: 'top'
      }"
    />
  </div>
</template>
