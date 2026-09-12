# NestJS + TypeScript 搭建今日行动师Agent后端｜步骤总结
> 目标：搭建完整骨架，实现注册登录JWT鉴权、MySQL数据库、模块分层，后续填充Agent业务逻辑
> 前置条件：Node.js LTS(20.x/22.x)、MySQL本地运行、npm≥9

## 总览
1. 环境准备 + Nest脚手架创建项目
2. 安装全部依赖，配置`.env`环境变量
3. MySQL手动创建数据库（表由TypeORM自动生成）
4. 配置环境变量读取 + TypeORM数据库连接
5. User用户模块：实体、DTO、注册登录接口
6. 全局开启DTO参数校验、跨域
7. JWT鉴权体系：守卫、策略、获取用户装饰器
8. Agent业务模块：3张核心表实体、模块注册
9. 后续待完成业务清单

---

## 步骤1：全局脚手架 + 创建项目
**操作**
```bash
# 全局安装nest命令行工具
npm install -g @nestjs/cli
# 创建项目
nest new action-agent-nest
# 选npm
cd action-agent-nest
# 开发模式启动
npm run start:dev
```
访问 `http://127.0.0.1:3000` 看到Hello World即成功。

**原理**
- `@nestjs/cli`：官方脚手架，快速生成模块/控制器/服务，减少样板代码
- `start:dev`：开发模式，文件修改自动重启

**核心Nest概念速记**
- Module：功能容器（用户模块、Agent模块）
- Controller：接收HTTP请求，只做入参接收，不写业务
- Service：写业务逻辑、数据库、调用大模型，控制器调用Service
- DTO：入参校验对象
- Provider：Service属于Provider，依赖注入DI，不需要手动new类

---

## 步骤2：安装依赖 + 编写.env配置文件
### 安装依赖
```bash
# 生产依赖
npm install @nestjs/typeorm typeorm mysql2 @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs dotenv class-validator class-transformer
# 开发类型依赖
npm install -D @types/bcryptjs @types/passport-jwt
```

### 根目录新建 `.env`
```env
PORT=3000
# MySQL
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的mysql密码
MYSQL_DATABASE=action_agent_nest_db
# JWT
JWT_SECRET=action_agent_2026_secret_key_xxxx
JWT_EXPIRES_IN=7d
# LLM大模型
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=sk‑xxxx你的key
LLM_MODEL=deepseek‑chat
```
> ⚠️ `.env`不要提交git，`.gitignore`已默认忽略

**包作用摘要**
- `@nestjs/typeorm+typeorm+mysql2`：ORM框架，实体类映射MySQL表，少写SQL
- `@nestjs/jwt/passport`：JWT签发、校验、接口登录守卫
- `bcryptjs`：密码哈希加密，不存明文
- `dotenv`：读取环境变量
- `class‑validator/class‑transformer`：DTO自动校验前端入参

---

## 步骤3：MySQL创建数据库
打开MySQL客户端执行SQL：
```sql
CREATE DATABASE action_agent_nest_db DEFAULT CHARACTER SET utf8mb4;
```
> 只建库，**不需要手动建表**，TypeORM实体自动生成数据表。

---

## 步骤4：配置环境变量与TypeORM数据库
1. 新建 `src/config/configuration.ts`，统一读取解析`.env`配置
```typescript
// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  database: {
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT!,10),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN
  },
  llm:{
    baseUrl: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL
  }
})
```

2. 修改 `src/app.module.ts`，注册`ConfigModule`、`TypeOrmModule`
```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // ⚠️开发开启；生产必须关闭，使用迁移
        autoLoadEntities: true,
        charset: 'utf8mb4'
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}
```

**要点**
- `ConfigModule.isGlobal:true`：全局可用`ConfigService`读取配置
- `synchronize:true`：开发环境实体变更自动同步数据表；生产关闭，用数据库迁移
- `entities`：自动扫描项目下所有`*.entity.ts`作为数据库映射实体

重启 `npm run start:dev`，无报错代表数据库连接成功。

---

## 步骤5：创建User用户模块（注册、登录）
### 5‑1 生成模块文件
```bash
nest generate module user
nest generate controller user
nest generate service user
```

### 5‑2 新建用户实体 `src/user/entities/user.entity.ts`
> Entity：类映射MySQL数据表，属性映射字段。

### 5‑3 新建DTO入参校验
- `src/user/dto/register.dto.ts` 注册入参校验
- `src/user/dto/login.dto.ts` 登录入参校验

### 5‑4 修改 `user.module.ts`
注册TypeORM实体，异步引入JwtModule。

### 5‑5 编写 `user.service.ts`
业务逻辑：
1. register：判断用户名是否重复，bcrypt哈希密码，保存用户
2. login：查询用户、比对密码，签发JWT token返回

### 5‑6 编写 `user.controller.ts`
暴露接口：
- `POST /user/register` 注册
- `POST /user/login` 登录返回token

### 5‑7 修改 `src/main.ts`：全局校验管道 + 跨域
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist:true }));
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```
> `ValidationPipe`：让DTO参数校验生效；`whitelist:true`自动剔除前端多余字段；`enableCors()`开启跨域支持前端访问。

重启服务，调用注册接口，数据库自动生成user表。

---

## 步骤6：搭建JWT鉴权体系（保护需要登录的接口）
> 作用：Agent相关接口必须携带`Authorization: Bearer token`才可访问，解析token拿到userId。

### 文件清单新建
1. `src/common/guards/jwt-auth.guard.ts`：鉴权守卫
2. `src/common/strategies/jwt.strategy.ts`：JWT解析策略，token解析成功后把`{userId}`挂载到`req.user`
3. `src/common/decorators/get-user.decorator.ts`：自定义装饰器，在controller直接获取登录用户信息

### 修改 `app.module.ts`
- 导入`JwtStrategy`
- 在`@Module({providers:[JwtStrategy]})`注册策略

**使用方式**
在Controller方法上添加装饰器：
```typescript
@UseGuards(JwtAuthGuard)
xxx(@GetUser() user:{userId:number})
```

---

## 步骤7：生成Agent业务模块（数据库骨架）
### 7‑1 生成模块文件
```bash
nest generate module agent
nest generate controller agent
nest generate service agent
```

### 7‑2 创建3个核心实体
1. `src/agent/entities/task.entity.ts`：任务表
2. `src/agent/entities/task‑session.entity.ts`：Agent会话表
3. `src/agent/entities/action‑record.entity.ts`：用户行为记录表

> 实体配置好外键关联（User ↔ Task ↔ TaskSession ↔ ActionRecord）

### 7‑3 修改 `agent.module.ts`
TypeOrmModule.forFeature注册这3个实体。

重启项目，TypeORM自动生成三张数据表。

---

# ✅ 当前已完成全部骨架能力
1. NestJS+TS项目初始化、开发热更新
2. dotenv环境变量集中管理配置
3. TypeORM连接MySQL，实体自动建表
4. User模块：注册、登录、bcrypt密码加密、JWT签发token
5. JWT‑Passport鉴权：守卫、策略、获取登录用户装饰器
6. Agent完整数据表实体：`task`、`task_session`、`action_record`
7. 全局DTO参数校验、跨域开启
8. 接口：`POST /user/register`、`POST /user/login`可直接测试

---

# 📌 后续需要填充实现的业务清单
1. 新建 `agent/dto`：编写创建会话、提交行为记录的入参DTO
2. `agent.service.ts`：
   - 查询历史行为，生成用户摘要
   - HTTP调用LLM大模型，组装prompt
   - 保存task、task_session、action_record数据
3. `agent.controller.ts`：编写业务接口，加上`@UseGuards(JwtAuthGuard)`鉴权保护
4. 对接Vue3前端