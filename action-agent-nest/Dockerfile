# NestJS 后端生产镜像
# 用法：docker build -t jdi-backend .
# 多阶段构建：Stage 1 编译 → Stage 2 只保留产物 + 运行依赖（镜像从 ~500MB 压到 ~200MB）
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# ── 生产镜像 ──
FROM node:22-alpine

RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

WORKDIR /app

# 只复制运行时所需文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY ecosystem.config.cjs ./

EXPOSE 3000

# 默认用 pm2 守护；也可直接用 `node dist/main.js`
CMD ["npx", "pm2-runtime", "ecosystem.config.cjs"]
