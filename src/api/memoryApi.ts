// 用户长期记忆接口（3.2）：统计页关键词汇总读取用
import { authRequest } from "./http";

export interface UserMemoryItem {
  id: number;
  userId: number;
  memoryType: string;
  content: string;
  /** 3~5 字气泡关键词；老数据可能为 null（只进底部总结、不渲染气泡） */
  keyword: string | null;
  memoryKey: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

/** 获取当前用户的全部长期记忆（后端按更新时间倒序） */
export function getMemories(): Promise<UserMemoryItem[]> {
  return authRequest<UserMemoryItem[]>("/api/memory");
}

/**
 * 获取统计页底部综合论述：后端 LLM 把全部记忆综合成一段整体画像。
 * 无记忆或 LLM 失败时返回 null，由调用方兜底为置信度最高的单条记忆原文。
 */
export async function getMemorySummary(): Promise<string | null> {
  const data = await authRequest<{ summary: string | null }>("/api/memory/summary");
  return data?.summary ?? null;
}
