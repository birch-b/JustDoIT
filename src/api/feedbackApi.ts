// 意见反馈 API：POST /api/feedback（登录用户与游客均可提交）
import { authRequest } from "@/api/http";
import { getVisitorId } from "@/utils/visitorId";

const BASE_URL = "/api/feedback";

export const feedbackApi = {
  /** 提交意见反馈；游客靠 visitorId 被后台识别（登录用户后端会忽略该字段） */
  submit(content: string) {
    return authRequest<{ ok: boolean }>(BASE_URL, {
      method: "POST",
      body: JSON.stringify({ content, visitorId: getVisitorId() }),
    });
  },
};
