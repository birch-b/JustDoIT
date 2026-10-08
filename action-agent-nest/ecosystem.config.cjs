// pm2 进程守护配置：服务器上 `pm2 start ecosystem.config.cjs` 启动后端
// 重启策略：崩溃自动拉起；内存超 500M 重启；日志按天切割需 pm2 install pm2-logrotate
module.exports = {
  apps: [
    {
      name: "jdi-backend",
      script: "dist/main.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      // 崩溃自动重启，最小间隔 3s，最多连续 10 次（防配置错误死循环）
      restart_delay: 3000,
      max_restarts: 10,
      // 内存阈值重启
      max_memory_restart: "500M",
      // 日志
      out_file: "logs/out.log",
      error_file: "logs/err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
