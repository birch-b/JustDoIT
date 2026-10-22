<script setup lang="ts">
// 后台管理页 /admin（仅 role=admin 可访问，路由守卫拦截）
// 区块：站点统计卡片 / 活跃用户 / 反馈收集 / 公告管理
import { onMounted, reactive, ref } from "vue";
import {
  adminApi,
  type AdminOverview,
  type AdminFeedbackItem,
  type AdminUserItem,
  ADMIN_USER_STATUS_LABEL,
  type UpsertAnnouncementPayload,
} from "@/api/adminApi";
import {
  ANNOUNCEMENT_TYPE_LABEL,
  type Announcement,
  type AnnouncementItem,
} from "@/api/announcementApi";
import PageWrapper from "@/components/layout/PageWrapper.vue";
import SketchBorder from "@/components/sketch/SketchBorder.vue";
import DualTextBlock from "@/components/sketch/DualTextBlock.vue";
import LinearButton from "@/components/sketch/LinearButton.vue";
import SketchConfirmDialog from "@/components/sketch/SketchConfirmDialog.vue";

const overview = ref<AdminOverview | null>(null);
const users = ref<AdminUserItem[]>([]);
const feedbacks = ref<AdminFeedbackItem[]>([]);
const announcements = ref<Announcement[]>([]);
const loading = ref(true);
const errorMsg = ref("");

function fmtTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadAll() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const [o, u, f, a] = await Promise.all([
      adminApi.overview(),
      adminApi.users(),
      adminApi.feedbacks(),
      adminApi.announcements(),
    ]);
    overview.value = o;
    users.value = u;
    feedbacks.value = f;
    announcements.value = a;
  } catch (e) {
    errorMsg.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}
onMounted(loadAll);

// ===== 公告编辑 =====
const ITEM_TYPES: AnnouncementItem["type"][] = ["new", "improve", "fix"];

const editingId = ref<number | null>(null); // null=新建；0=未在编辑
const showForm = ref(false);
const saving = ref(false);
const formError = ref("");
const form = reactive<UpsertAnnouncementPayload>({
  title: "",
  date: new Date().toISOString().slice(0, 10),
  items: [{ type: "new", text: "" }],
});

function startCreate() {
  editingId.value = null;
  form.title = "";
  form.date = new Date().toISOString().slice(0, 10);
  form.items = [{ type: "new", text: "" }];
  formError.value = "";
  showForm.value = true;
}
function startEdit(a: Announcement) {
  editingId.value = a.id;
  form.title = a.title;
  form.date = a.date;
  form.items = a.items.map((i) => ({ ...i }));
  formError.value = "";
  showForm.value = true;
}
function cancelForm() {
  showForm.value = false;
}
function addItem() {
  form.items.push({ type: "new", text: "" });
}
function removeItem(i: number) {
  form.items.splice(i, 1);
}
function cycleType(item: AnnouncementItem) {
  const idx = ITEM_TYPES.indexOf(item.type);
  item.type = ITEM_TYPES[(idx + 1) % ITEM_TYPES.length];
}

async function saveForm() {
  if (saving.value) return;
  formError.value = "";
  if (!form.title.trim()) {
    formError.value = "标题不能为空";
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    formError.value = "日期格式必须是 YYYY-MM-DD";
    return;
  }
  const items = form.items.filter((i) => i.text.trim());
  if (!items.length) {
    formError.value = "至少需要一条内容";
    return;
  }
  saving.value = true;
  try {
    const payload = { title: form.title.trim(), date: form.date, items };
    if (editingId.value === null) {
      await adminApi.createAnnouncement(payload);
    } else {
      await adminApi.updateAnnouncement(editingId.value, payload);
    }
    showForm.value = false;
    announcements.value = await adminApi.announcements();
  } catch (e) {
    formError.value = (e as Error).message || "保存失败";
  } finally {
    saving.value = false;
  }
}

// 删除公告
const deletingTarget = ref<Announcement | null>(null);
const deleting = ref(false);
async function doDelete() {
  if (!deletingTarget.value || deleting.value) return;
  deleting.value = true;
  try {
    await adminApi.deleteAnnouncement(deletingTarget.value.id);
    deletingTarget.value = null;
    announcements.value = await adminApi.announcements();
  } catch (e) {
    formError.value = (e as Error).message || "删除失败";
  } finally {
    deleting.value = false;
  }
}

function tagClass(type: AnnouncementItem["type"]) {
  if (type === "new") return "bg-sketch-accent/25 border-sketch-accent/60";
  if (type === "improve") return "bg-sketch-hover border-sketch-line/30";
  return "bg-transparent border-sketch-line/40";
}
</script>

<template>
  <PageWrapper title="后台管理" subtitle="ADMIN">
    <div class="mx-auto max-w-5xl">
      <!-- 加载 / 错误 -->
      <p v-if="loading" class="py-10 text-center text-sm font-light text-sketch-lineSub">加载中…</p>
      <p v-else-if="errorMsg" class="border border-sketch-line/40 px-3 py-2 text-xs text-sketch-line">
        {{ errorMsg }}
      </p>

      <template v-else>
        <!-- 统计卡片 -->
        <section class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SketchBorder padding="1.25rem 1rem">
            <p class="text-center text-2xl md:text-3xl font-light">{{ overview?.totalUsers ?? 0 }}</p>
            <p class="mt-1 text-center text-xs font-light text-sketch-lineSub">用户总数</p>
            <p class="text-center text-[10px] font-en tracking-widest text-sketch-lineSub/70">USERS</p>
          </SketchBorder>
          <SketchBorder padding="1.25rem 1rem">
            <p class="text-center text-2xl md:text-3xl font-light">{{ overview?.totalVisits ?? 0 }}</p>
            <p class="mt-1 text-center text-xs font-light text-sketch-lineSub">总访问量</p>
            <p class="text-center text-[10px] font-en tracking-widest text-sketch-lineSub/70">VISITS</p>
          </SketchBorder>
          <SketchBorder padding="1.25rem 1rem">
            <p class="text-center text-2xl md:text-3xl font-light">{{ overview?.todayVisits ?? 0 }}</p>
            <p class="mt-1 text-center text-xs font-light text-sketch-lineSub">今日访问</p>
            <p class="text-center text-[10px] font-en tracking-widest text-sketch-lineSub/70">TODAY</p>
          </SketchBorder>
          <SketchBorder padding="1.25rem 1rem">
            <p class="text-center text-2xl md:text-3xl font-light">{{ overview?.todayActiveUsers ?? 0 }}</p>
            <p class="mt-1 text-center text-xs font-light text-sketch-lineSub">今日活跃用户</p>
            <p class="text-center text-[10px] font-en tracking-widest text-sketch-lineSub/70">ACTIVE</p>
          </SketchBorder>
        </section>

        <!-- 用户列表 -->
        <section class="mt-8">
          <DualTextBlock cn="用户列表" en="USERS" size="sm" weight="normal" />
          <SketchBorder padding="1.25rem 1.5rem" class="mt-3">
            <p v-if="!users.length" class="text-xs font-light text-sketch-lineSub">
              还没有注册用户。
            </p>
            <ul v-else class="divide-y divide-sketch-line/15">
              <li v-for="u in users" :key="u.id" class="py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-light text-sketch-line">{{ u.username }}</span>
                  <span
                    class="inline-block shrink-0 border px-1.5 py-0.5 text-[10px] leading-none"
                    :class="
                      u.status === 'active'
                        ? 'bg-sketch-accent/25 border-sketch-accent/60'
                        : u.status === 'quiet'
                          ? 'bg-sketch-hover border-sketch-line/30'
                          : 'bg-transparent border-sketch-line/40'
                    "
                  >
                    {{ ADMIN_USER_STATUS_LABEL[u.status] }}
                  </span>
                </div>
                <p class="mt-1 text-xs font-light text-sketch-lineSub">
                  {{ u.email }} · 注册于 {{ fmtTime(u.registeredAt) }} ·
                  {{ u.lastActiveAt ? `最后活跃 ${fmtTime(u.lastActiveAt)}` : "没有访问记录" }}
                </p>
              </li>
            </ul>
          </SketchBorder>
        </section>

        <!-- 活跃用户 -->
        <section class="mt-8">
          <DualTextBlock cn="活跃用户" en="ACTIVE USERS" size="sm" weight="normal" />
          <SketchBorder padding="1.25rem 1.5rem" class="mt-3">
            <p v-if="!overview?.activeUsers.length" class="text-xs font-light text-sketch-lineSub">
              还没有访问记录。部署后用户打开网站即会上报。
            </p>
            <ul v-else class="divide-y divide-sketch-line/15">
              <li
                v-for="(u, i) in overview.activeUsers"
                :key="i"
                class="flex items-center justify-between py-2 text-sm font-light"
              >
                <span class="text-sketch-line">{{ u.username }}</span>
                <span class="text-xs text-sketch-lineSub">{{ fmtTime(u.lastActiveAt) }}</span>
              </li>
            </ul>
          </SketchBorder>
        </section>

        <!-- 反馈收集 -->
        <section class="mt-8">
          <DualTextBlock cn="反馈收集" en="FEEDBACK" size="sm" weight="normal" />
          <SketchBorder padding="1.25rem 1.5rem" class="mt-3">
            <p v-if="!feedbacks.length" class="text-xs font-light text-sketch-lineSub">
              还没有收到反馈。
            </p>
            <ul v-else class="divide-y divide-sketch-line/15">
              <li v-for="f in feedbacks" :key="f.id" class="py-2.5">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-xs text-sketch-line">{{ f.username }}</span>
                  <span class="shrink-0 text-[10px] text-sketch-lineSub">{{ fmtTime(f.createdAt) }}</span>
                </div>
                <p class="mt-1 whitespace-pre-wrap text-sm font-light leading-relaxed text-sketch-lineSub">
                  {{ f.content }}
                </p>
              </li>
            </ul>
          </SketchBorder>
        </section>

        <!-- 公告管理 -->
        <section class="mt-8">
          <div class="flex items-center justify-between">
            <DualTextBlock cn="公告管理" en="ANNOUNCEMENTS" size="sm" weight="normal" />
            <LinearButton v-if="!showForm" size="sm" @click="startCreate">
              <span>+ 新公告</span>
            </LinearButton>
          </div>

          <!-- 编辑表单 -->
          <SketchBorder v-if="showForm" padding="1.5rem" class="mt-3">
            <p class="text-sm font-light">{{ editingId === null ? "新公告" : "编辑公告" }}</p>
            <div class="mt-3 space-y-3">
              <div class="flex flex-wrap gap-3">
                <input
                  v-model="form.title"
                  class="sketch-input flex-1 min-w-[10rem]"
                  maxlength="50"
                  placeholder="标题，如：偏好问卷上线"
                />
                <input
                  v-model="form.date"
                  class="sketch-input w-32"
                  placeholder="2026-10-22"
                />
              </div>
              <div
                v-for="(item, i) in form.items"
                :key="i"
                class="flex items-start gap-2"
              >
                <button
                  class="mt-1 inline-block shrink-0 border px-1.5 py-0.5 text-[10px] leading-none"
                  :class="tagClass(item.type)"
                  title="点击切换类型"
                  @click="cycleType(item)"
                >
                  {{ ANNOUNCEMENT_TYPE_LABEL[item.type] }}
                </button>
                <input
                  v-model="item.text"
                  class="sketch-input flex-1 min-w-0"
                  maxlength="200"
                  placeholder="这条更新了什么…"
                />
                <button
                  class="mt-1 shrink-0 text-sketch-lineSub hover:text-sketch-line"
                  :disabled="form.items.length <= 1"
                  @click="removeItem(i)"
                >
                  ✕
                </button>
              </div>
              <button
                class="text-xs text-sketch-lineSub hover:text-sketch-line"
                @click="addItem"
              >
                + 添加一条
              </button>
              <p v-if="formError" class="border border-sketch-line/40 px-3 py-2 text-xs text-sketch-line">
                {{ formError }}
              </p>
              <div class="flex justify-end gap-3">
                <LinearButton size="sm" :disabled="saving" @click="cancelForm">
                  <span>取消</span>
                </LinearButton>
                <LinearButton size="sm" :disabled="saving" @click="saveForm">
                  <span>{{ saving ? "保存中…" : "保存" }}</span>
                </LinearButton>
              </div>
            </div>
          </SketchBorder>

          <!-- 公告列表 -->
          <SketchBorder padding="1.25rem 1.5rem" class="mt-3">
            <p v-if="!announcements.length" class="text-xs font-light text-sketch-lineSub">
              还没有公告。用户端铃铛只显示最近 7 天内发布的。
            </p>
            <ul v-else class="divide-y divide-sketch-line/15">
              <li v-for="a in announcements" :key="a.id" class="py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-sm font-light text-sketch-line">{{ a.title }}</p>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="text-[10px] text-sketch-lineSub">{{ a.date }}</span>
                    <button class="text-xs text-sketch-lineSub hover:text-sketch-line" @click="startEdit(a)">
                      编辑
                    </button>
                    <button class="text-xs text-sketch-lineSub hover:text-sketch-line" @click="deletingTarget = a">
                      删除
                    </button>
                  </div>
                </div>
                <ul class="mt-1.5 space-y-1">
                  <li
                    v-for="(item, i) in a.items"
                    :key="i"
                    class="flex items-start gap-1.5 text-xs font-light text-sketch-lineSub"
                  >
                    <span
                      class="mt-0.5 inline-block shrink-0 border px-1 py-px text-[10px] leading-none"
                      :class="tagClass(item.type)"
                    >
                      {{ ANNOUNCEMENT_TYPE_LABEL[item.type] }}
                    </span>
                    <span class="min-w-0">{{ item.text }}</span>
                  </li>
                </ul>
              </li>
            </ul>
          </SketchBorder>
        </section>
      </template>
    </div>

    <!-- 删除公告确认 -->
    <SketchConfirmDialog
      :open="!!deletingTarget"
      title="删除公告"
      :message="`确定删除公告「${deletingTarget?.title ?? ''}」吗？删除后用户端立即不可见。`"
      :loading="deleting"
      @confirm="doDelete"
      @cancel="deletingTarget = null"
    />
  </PageWrapper>
</template>
