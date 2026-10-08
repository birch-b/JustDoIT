// src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { assertDataEncryptionKey } from './common/crypto/field-crypto';
//全局校验管道 + 跨域
async function bootstrap() {
  // 字段加密密钥缺失/格式错误时拒绝启动（与 Redis 探活同策略，避免明文落库）
  assertDataEncryptionKey();
  const app = await NestFactory.create(AppModule);
  // CORS 收紧：仅放行白名单来源。本地开发默认放行 vite 端口；
  // 生产部署在 .env 配置 CORS_ORIGINS（逗号分隔多个，如 https://your-domain.com）
  const allowedOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://127.0.0.1:5174'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins });
  app.setGlobalPrefix('api'); // ✅ 全局所有接口自动加上 /api
  app.useGlobalPipes(new ValidationPipe({ whitelist:true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//`ValidationPipe`：让 DTO 参数校验生效；
// `whitelist:true`自动剔除前端多余字段；
// `enableCors()`开启跨域支持前端访问。
