// 用户长期记忆接口（3.2）：统计页关键词汇总读取用
import { authRequest } from "./http";

export interface UserMemoryItem {
  id: number;
  userId: number;
  memoryType: string;
  content: string;
  memoryKey: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

/** 获取当前用户的全部长期记忆（后端按更新时间倒序） */
export function getMemories(): Promise<UserMemoryItem[]> {
  return authRequest<UserMemoryItem[]>("/api/memory");
}
