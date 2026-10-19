// 全站统一的折叠抽屉交互：
// - 鼠标移入标题 → 展开预览；移开 → 折叠
// - 点击标题 → 钉住（固定展开，移开鼠标不再折叠）
// - 再次点击 → 取消钉住并立即折叠（即使鼠标仍停在标题上）；
//   鼠标离开标题后 hover 预览效果重新生效
// 触屏设备无 hover，点击即钉住/取消，行为退化为普通开关。
import { computed, reactive, ref } from "vue";

/** 单个抽屉 */
export function useHoverPinDrawer() {
  const hovered = ref(false);
  const pinned = ref(false);
  const expanded = computed(() => pinned.value || hovered.value);

  /** 挂在标题上：移入即预览展开 */
  function onEnter() {
    hovered.value = true;
  }
  /** 挂在包含标题+内容的容器上：移出整个抽屉区才折叠 */
  function onLeave() {
    hovered.value = false;
  }
  /** 挂在标题点击：切换钉住；取消钉住时立即收起 */
  function toggle() {
    pinned.value = !pinned.value;
    if (!pinned.value) hovered.value = false;
  }
  return { expanded, pinned, onEnter, onLeave, toggle };
}

/** 一组抽屉（按 key 管理；同一时刻只有一个处于 hover 展开） */
export function useHoverPinDrawerGroup() {
  const hoveredKey = ref<string | null>(null);
  const pinnedKeys = reactive(new Set<string>());

  function isOpen(key: string) {
    return pinnedKeys.has(key) || hoveredKey.value === key;
  }
  function onEnter(key: string) {
    hoveredKey.value = key;
  }
  function onLeave(key: string) {
    if (hoveredKey.value === key) hoveredKey.value = null;
  }
  function toggle(key: string) {
    if (pinnedKeys.has(key)) {
      pinnedKeys.delete(key);
      if (hoveredKey.value === key) hoveredKey.value = null;
    } else {
      pinnedKeys.add(key);
    }
  }
  return { isOpen, onEnter, onLeave, toggle };
}
