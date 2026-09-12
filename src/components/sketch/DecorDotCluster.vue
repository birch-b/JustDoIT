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
  }
})

const dotList = ref<DotMeta[]>([])
const containerRef = ref<HTMLDivElement | null>(null)
let rafId: number | null = null

function generateDots() {
  if (!containerRef.value) return
  const dom = containerRef.value
  const rect = props.fullscreen
    ? { width: window.innerWidth, height: window.innerHeight }
    : dom.getBoundingClientRect()
  const dots: DotMeta[] = []
  for (let i = 0; i < props.count; i++) {
    let x: number, y: number
    let inSafeZone: boolean
    let retry = 0
    do {
      x = Math.random() * (rect.width + props.spread * 2) - props.spread
      y = Math.random() * (rect.height + props.spread * 2) - props.spread
      inSafeZone =
        x > props.safeInset &&
        x < rect.width - props.safeInset &&
        y > props.safeInset &&
        y < rect.height - props.safeInset
      retry++
    } while (inSafeZone && retry < 80)
    const scale = 0.5 + Math.random() * 0.9
    const isHollow = Math.random() < props.hollowRatio
    dots.push({
      x,
      y,
      svgSize: props.baseSvgSize * scale,
      dotSize: props.baseDotRadius * scale,
      hollow: isHollow,
      opacity: props.minOpacity + Math.random() * (props.maxOpacity - props.minOpacity),
      phase: Math.random(), // 0~1
      cycleTime: props.cycleMin + Math.random() * (props.cycleMax - props.cycleMin),
      amplitude: props.minAmp + Math.random() * (props.maxAmp - props.minAmp),
      damp: props.dampMin + Math.random() * (props.dampMax - props.dampMin),
      offsetY: 0
    })
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
  if (!props.enableBounce) return
  dotList.value.forEach(dot => {
    // 基于 performance.now 真实时间，永不归零
    const localT = ((time / dot.cycleTime) + dot.phase) % 1
    dot.offsetY = calcInfiniteOsc(localT, dot.amplitude, dot.damp)
  })
  rafId = requestAnimationFrame(animate)
}

function onResize() {
  nextTick(generateDots)
}

onMounted(() => {
  nextTick(generateDots)
  window.addEventListener('resize', onResize)
  if (props.enableBounce) {
    rafId = requestAnimationFrame(animate)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
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
