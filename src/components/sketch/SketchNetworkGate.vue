<script setup lang="ts">
// 全屏「加载中 / 网络异常」门屏：登录后进入首页、且本地无任何缓存数据时展示
// - loading：波点波动动画 + 品牌小字
// - error：手绘云朵断网插画，区分「设备断网」与「服务器连不上」，可手动重试；
//   浏览器 online 事件触发时自动重试，无需用户操作
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import SketchThinkingDots from "./SketchThinkingDots.vue";
import LinearButton from "./LinearButton.vue";
import DualTextBlock from "./DualTextBlock.vue";

interface Props {
  state: "loading" | "error";
}
const props = defineProps<Props>();
const emit = defineEmits<{ retry: [] }>();

// 设备本身是否离线（拔网线/关 WiFi）；服务器挂了但设备在线时为 false
const offline = ref(typeof navigator !== "undefined" ? !navigator.onLine : false);

function onOffline() {
  offline.value = true;
}
function onOnline() {
  offline.value = false;
  // 网络恢复瞬间若正停在错误页，自动拉一次，体验像小程序一样「自己好了」
  if (props.state === "error") emit("retry");
}

onMounted(() => {
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
});
onBeforeUnmount(() => {
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
});

const cnText = computed(() =>
  offline.value ? "网断了，检查下 WiFi 或流量吧" : "网络开小差了，内容暂时没加载出来",
);
const enText = computed(() => (offline.value ? "YOU ARE OFFLINE" : "CONNECTION LOST"));
const hintText = computed(() =>
  offline.value ? "恢复网络后会自动重试" : "别担心，记录都在，稍后再试试",
);
</script>

<template>
  <Teleport to="body">
    <Transition name="gate-fade">
      <div
        class="fixed inset-0 z-[80] flex items-center justify-center bg-sketch-bg px-6"
        role="status"
        aria-live="polite"
      >
        <!-- 加载中：品牌小字 + 波点波动 -->
        <div v-if="state === 'loading'" class="flex flex-col items-center">
          <p class="text-xl font-light text-sketch-line">拍板大王</p>
          <p class="mt-1 text-[10px] font-en tracking-[0.35em] text-sketch-lineSub">
            JUST DO IT
          </p>
          <div class="mt-12">
            <SketchThinkingDots label="正在准备你的内容" sub-label="LOADING" />
          </div>
        </div>

        <!-- 网络异常：手绘云朵断网插画 + 重试 -->
        <div v-else class="flex flex-col items-center text-center">
          <div class="gate-illu" aria-hidden="true">
            <svg width="220" height="190" viewBox="0 0 240 200" fill="none">
              <!-- 外圈双层缠绕云朵，沿用时钟的手绘环线画法 -->
              <g class="cloud-float">
                <path
                  d="M58,108 C34,108 32,74 58,70 C62,46 96,42 110,58 C124,42 156,48 158,70 C184,70 188,104 164,108 Z"
                  stroke="#634442"
                  stroke-width="3"
                  stroke-linejoin="round"
                  fill="#FFF8EE"
                />
                <path
                  d="M66,100 C48,100 47,80 64,78 C68,62 92,60 102,70 C112,58 138,62 140,78 C158,78 160,98 144,100"
                  stroke="#634442"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  opacity="0.45"
                />
                <!-- 云朵里的 WiFi 信号弧 + 斜杠 -->
                <path
                  d="M90,96 Q105,84 120,96"
                  stroke="#634442"
                  stroke-width="2.4"
                  stroke-linecap="round"
                />
                <path
                  d="M80,88 Q105,70 130,88"
                  stroke="#A9C8C2"
                  stroke-width="2.4"
                  stroke-linecap="round"
                />
                <circle cx="105" cy="103" r="3" fill="#634442" />
                <line
                  x1="78" y1="112" x2="134" y2="74"
                  stroke="#634442"
                  stroke-width="3"
                  stroke-linecap="round"
                  class="slash-pulse"
                />
              </g>
              <!-- 周围浮动小波点，增加生动感 -->
              <circle class="dot-bob d1" cx="40" cy="50" r="4.5" fill="#A9C8C2" />
              <circle class="dot-bob d2" cx="198" cy="56" r="3.5" fill="#634442" opacity="0.55" />
              <circle class="dot-bob d3" cx="206" cy="128" r="5" fill="#A9C8C2" opacity="0.8" />
              <circle class="dot-bob d4" cx="30" cy="130" r="3" fill="#634442" opacity="0.45" />
            </svg>
          </div>

          <DualTextBlock :cn="cnText" :en="enText" size="md" class="mt-6" />
          <p class="mt-3 text-sm font-light text-sketch-lineSub">{{ hintText }}</p>

          <LinearButton size="md" class="mt-8" @click="emit('retry')">
            <span>重新加载</span>
          </LinearButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 门屏淡入淡出，避免突然糊脸 */
.gate-fade-enter-active,
.gate-fade-leave-active {
  transition: opacity 0.3s ease;
}
.gate-fade-enter-from,
.gate-fade-leave-to {
  opacity: 0;
}

/* 云朵轻轻上下漂浮 */
.cloud-float {
  transform-origin: center;
  animation: cloud-bob 3.2s ease-in-out infinite;
}
@keyframes cloud-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-7px) rotate(1deg);
  }
}

/* 断开斜杠缓慢呼吸，暗示「信号不通」 */
.slash-pulse {
  animation: slash-blink 2.4s ease-in-out infinite;
}
@keyframes slash-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

/* 周围小波点各自错峰浮动 */
.dot-bob {
  animation: dot-bob 2.8s ease-in-out infinite;
}
.dot-bob.d1 {
  animation-delay: 0s;
}
.dot-bob.d2 {
  animation-delay: 0.5s;
}
.dot-bob.d3 {
  animation-delay: 1s;
}
.dot-bob.d4 {
  animation-delay: 1.5s;
}
@keyframes dot-bob {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.9;
  }
  50% {
    transform: translateY(-6px);
    opacity: 0.45;
  }
}

/* 尊重系统减少动态偏好：插画静止，只保留信息表达 */
@media (prefers-reduced-motion: reduce) {
  .cloud-float,
  .slash-pulse,
  .dot-bob {
    animation: none;
  }
}
</style>
