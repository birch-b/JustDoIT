// 邮箱验证码服务：Redis 存储，验证码 key 为 `vcode:${type}:${email}`，频控 key 为 `vcode:interval:${type}:${email}`
// type 状态字段区分用途：register=注册 / reset=找回密码 / delete=注销账户，三种码互不通用
import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type CodeType = 'register' | 'reset' | 'delete';

const CODE_TTL_SECONDS = 5 * 60; // 验证码有效期 5 分钟
const SEND_INTERVAL_SECONDS = 60; // 同一邮箱 60 秒内只能发一次

@Injectable()
export class VerifyCodeService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;

  constructor(private readonly configService: ConfigService) {}

  /** 启动即探活：Redis 连不上直接让应用启动失败，不静默退回内存存储 */
  async onModuleInit() {
    const url =
      this.configService.get<string>('redis.url') ?? 'redis://localhost:6379';
    this.redis = new Redis(url, {
      lazyConnect: true, // 手动 connect，首连失败立即 reject，快速失败
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    try {
      await this.redis.connect();
    } catch (err) {
      this.redis.disconnect();
      throw new Error(
        `无法连接 Redis（${url}），验证码服务不可用，请先启动 Redis。原始错误：${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  /** 生成并存储验证码，返回验证码 */
  async create(type: CodeType, email: string): Promise<string> {
    // NX：仅当频控 key 不存在时写入成功，原子实现「60 秒内只能发一次」
    const allowed = await this.redis.set(
      `vcode:interval:${type}:${email}`,
      '1',
      'EX',
      SEND_INTERVAL_SECONDS,
      'NX',
    );
    if (allowed === null) {
      const ttl = await this.redis.ttl(`vcode:interval:${type}:${email}`);
      const wait = ttl > 0 ? ttl : SEND_INTERVAL_SECONDS;
      throw new BadRequestException(`发送过于频繁，请 ${wait} 秒后再试`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    // SET code EX 300：到期 Redis 自动清除
    await this.redis.set(
      `vcode:${type}:${email}`,
      code,
      'EX',
      CODE_TTL_SECONDS,
    );
    return code;
  }

  /** 校验验证码：正确则立即删除（一次性），错误/过期/类型不匹配均抛异常 */
  async verify(type: CodeType, email: string, code: string): Promise<void> {
    const saved = await this.redis.get(`vcode:${type}:${email}`);
    if (saved === null) {
      // TTL 到期后 key 自动消失，未发送与过期在此统一提示
      throw new BadRequestException('验证码无效或已过期，请重新获取');
    }
    if (saved !== code) {
      throw new BadRequestException('验证码错误');
    }
    // 校验成功立即焚毁，保证一次性
    await this.redis.del(`vcode:${type}:${email}`);
  }
}
