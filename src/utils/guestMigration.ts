// 游客数据迁移：登录/注册成功后把浏览器本地的会话与待办同步到当前用户名下
// 可重入：任一步失败中断并保留本地数据，下次登录重试（参考 todoStore.migrateLegacyTodos 模式）
import { guestStorage } from "./guestStorage";
import { agentApi } from "@/api/agentApi";
import { todoApi, type TodoCreateReq } from "@/api/todoApi";

/** 已迁移会话的新旧 ID 映射（oldId → newSessionId），中断重试时避免重复导入会话 */
const MIGRATED_KEY = "jdi_guest_migrated";

function loadMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MIGRATED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

/**
 * 迁移入口：会话整体导入拿 ID 映射 → 待办按映射换 sessionId 逐条创建 → 全部成功清本地。
 * 静默失败：任何异常都只中断本次迁移，绝不阻塞登录流程。
 */
export async function migrateGuestData(): Promise<void> {
  const sessions = guestStorage.loadSessions();
  const todos = guestStorage.loadTodos();
  if (!sessions.length && !todos.length) return;

  const map = loadMap();

  // 1) 会话导入（跳过已迁移过的）；失败中断，本地数据保留下次再试
  const pending = sessions.filter(
    (s) => map[String(s.session.sessionId)] === undefined
  );
  if (pending.length) {
    let mappings: { oldId: number; newSessionId: number }[];
    try {
      const res = await agentApi.importGuestSessions(
        pending.map((s) => ({
          oldId: s.session.sessionId,
          task: s.task,
          session: s.session,
          record: s.record,
          createdAt: s.createdAt,
        }))
      );
      mappings = res.mappings;
    } catch {
      return;
    }
    for (const m of mappings) map[String(m.oldId)] = m.newSessionId;
    try {
      localStorage.setItem(MIGRATED_KEY, JSON.stringify(map));
    } catch {
      // 映射写不进本地也无妨：最坏情况是重试时重复导入会话
    }
  }

  // 2) 待办迁移：拉服务端现有待办用于去重；sessionId 换新映射
  let serverTodos;
  try {
    serverTodos = await todoApi.list();
  } catch {
    return;
  }
  serverTodos = serverTodos ?? [];
  const localSessionIds = new Set(sessions.map((s) => s.session.sessionId));

  for (const t of todos) {
    let newSessionId: number | null = null;
    if (t.sessionId != null && localSessionIds.has(t.sessionId)) {
      const mapped = map[String(t.sessionId)];
      if (mapped === undefined) return; // 所属会话尚未迁完，下次再试
      newSessionId = mapped;
    }
    // 悬空引用（会话已被删/不在本地）：按手动待办迁移
    const exists = serverTodos.some(
      (s) =>
        (newSessionId !== null && s.sessionId === newSessionId) ||
        (newSessionId === null &&
          !s.sessionId &&
          s.taskContent === t.taskContent)
    );
    if (exists) continue;
    const req: TodoCreateReq = {
      taskContent: t.taskContent,
      category: t.category,
      deadline: t.deadline ?? null,
      sessionId: newSessionId,
      done: t.done,
      completedAt: t.completedAt ?? null,
    };
    try {
      const created = await todoApi.create(req);
      serverTodos.push(created);
    } catch {
      return; // 单条失败中断，保留本地数据下次再试
    }
  }

  // 3) 全部迁移成功：清空游客数据与迁移映射
  guestStorage.clearAll();
  localStorage.removeItem(MIGRATED_KEY);
}
