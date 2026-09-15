<script setup lang="ts">
// 通用邮箱验证码输入：6 位验证码输入框 + 发送按钮（60 秒倒计时）
// 纯 UI + 倒计时状态机：发送动作由父组件通过 onSend 注入，组件不耦合任何业务 API
// onSend resolve 才启动倒计时；reject（校验失败/请求失败）不启动，可立即重试
import { ref, onBeforeUnmount } from "vue";
import LinearButton from "./LinearButton.vue";
import DualTextBlock from "./DualTextBlock.vue";

const props = withDefaults(
  defineProps<{
    /** 验证码值（v-model） */
    modelValue: string;
    /** 发送验证码的异步动作：由页面决定调哪个 API、做什么前置校验；失败请 reject/throw */
    onSend: () => Promise<void>;
    placeholder?: string;
    /** 外部禁用（如表单未填完时禁止点击） */
    disabled?: boolean;
    labelCn?: string;
    labelEn?: string;
  }>(),
  {
    placeholder: "6 位数字",
    disabled: false,
    labelCn: "邮箱验证码",
    labelEn: "VERIFICATION CODE",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const sending = ref(false);
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function startCooldown() {
  cooldown.value = 60;
  timer = setInterval(() => {
    cooldown.value--;
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

async function handleSend() {
  if (sending.value || cooldown.value > 0 || props.disabled) return;
  sending.value = true;
  try {
    // 页面抛错时不启动倒计时，允许立即修正后重试
    await props.onSend();
    startCooldown();
  } finally {
    sending.value = false;
  }
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div>
    <DualTextBlock :cn="labelCn" :en="labelEn" size="sm" weight="normal" />
    <div class="mt-2 flex gap-2">
      <input
        :value="modelValue"
        type="text"
        inputmode="numeric"
        maxlength="6"
        class="sketch-input flex-1 min-w-0"
        :placeholder="placeholder"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <LinearButton
        type="button"
        size="md"
        :disabled="disabled || cooldown > 0 || sending"
        @click="handleSend"
      >
        <span class="whitespace-nowrap">
          {{ cooldown > 0 ? `${cooldown}s` : sending ? "发送中…" : "发送验证码" }}
        </span>
      </LinearButton>
    </div>
  </div>
</template>
