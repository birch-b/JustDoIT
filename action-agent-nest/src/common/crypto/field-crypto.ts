// 字段级加密工具：AES-256-GCM，保护用户对话类数据在数据库中的存储安全
// 设计要点：
// - 密文带 `enc:v1:` 版本前缀，格式 enc:v1:<iv>:<tag>:<cipher>（base64）
// - 每次写入随机 IV，同一明文密文不同；读取时按前缀识别，无前缀视为未迁移的老明文原样返回
// - 密钥来自环境变量 DATA_ENCRYPTION_KEY（64 位十六进制 = 32 字节），丢失即数据不可恢复，务必单独备份
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { ValueTransformer } from 'typeorm';

const PREFIX = 'enc:v1:';
const IV_LEN = 12; // GCM 推荐 96 位 IV

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('DATA_ENCRYPTION_KEY 未配置：请生成 64 位十六进制密钥写入 .env');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY 必须是 64 位十六进制（32 字节 AES-256 密钥）');
  }
  cachedKey = key;
  return key;
}

/** 启动时调用：密钥缺失/格式错误直接拒绝启动（与 Redis 探活同策略，fail-fast） */
export function assertDataEncryptionKey(): void {
  loadKey();
}

export function encryptText(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, encrypted].map((b) => b.toString('base64')).join(':');
}

export function decryptText(payload: string): string {
  // 老数据迁移前的明文兼容：无前缀直接返回
  if (!payload.startsWith(PREFIX)) return payload;
  const [iv, tag, encrypted] = payload
    .slice(PREFIX.length)
    .split(':')
    .map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** TypeORM 列转换器：写库加密、读库解密，业务代码零感知 */
export const encryptedTransformer: ValueTransformer = {
  to: (value: string | null) => (value == null ? value : encryptText(value)),
  from: (value: string | null) => (value == null ? value : decryptText(value)),
};
