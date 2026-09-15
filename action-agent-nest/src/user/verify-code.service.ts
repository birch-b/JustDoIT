// 邮箱验证码服务：内存存储，key 为 `${type}:${email}`
// type 状态字段区分用途：register=注册 / reset=找回密码 / delete=注销账户，三种码互不通用
import { BadRequestException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

export type CodeType = 'register' | 'reset' | 'delete';

interface CodeEntry {
  code: string;
  /** 过期时间戳(ms) */
  expiresAt: number;
  /** 上次发送时间戳(ms)，用于发送频率限制 */
  lastSentAt: number;
}

const CODE_TTL = 5 * 60 * 1000; // 验证码有效期 5 分钟
const SEND_INTERVAL = 60 * 1000; // 同一邮箱 60 秒内只能发一次

@Injectable()
export class VerifyCodeService {
  private store = new Map<string, CodeEntry>();

  /** 生成并存储验证码，返回验证码 */
  create(type: CodeType, email: string): string {
    const key = `${type}:${email}`;
    const exist = this.store.get(key);
    if (exist && Date.now() - exist.lastSentAt < SEND_INTERVAL) {
      const wait = Math.ceil((SEND_INTERVAL - (Date.now() - exist.lastSentAt)) / 1000);
      throw new BadRequestException(`发送过于频繁，请 ${wait} 秒后再试`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.store.set(key, { code, expiresAt: Date.now() + CODE_TTL, lastSentAt: Date.now() });
    return code;
  }

  /** 校验验证码：正确则立即删除（一次性），错误/过期/类型不匹配均抛异常 */
  verify(type: CodeType, email: string, code: string): void {
    const entry = this.store.get(`${type}:${email}`);
    if (!entry) {
      throw new BadRequestException('请先获取邮箱验证码');
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(`${type}:${email}`);
      throw new BadRequestException('验证码已过期，请重新获取');
    }
    if (entry.code !== code) {
      throw new BadRequestException('验证码错误');
    }
    this.store.delete(`${type}:${email}`);
  }
}
