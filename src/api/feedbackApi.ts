// 意见反馈 API：POST /api/feedback（需登录）
import { authRequest } from "@/api/http";

const BASE_URL = "/api/feedback";

export const feedbackApi = {
  /** 提交意见反馈 */
  submit(content: string) {
    return authRequest<{ ok: boolean }>(BASE_URL, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },
};
