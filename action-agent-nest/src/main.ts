// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
//全局校验管道 + 跨域
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api'); // ✅ 全局所有接口自动加上 /api
  app.useGlobalPipes(new ValidationPipe({ whitelist:true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//`ValidationPipe`：让 DTO 参数校验生效；
// `whitelist:true`自动剔除前端多余字段；
// `enableCors()`开启跨域支持前端访问。
