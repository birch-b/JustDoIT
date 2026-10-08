#!/bin/bash
# MySQL 定时备份脚本：每天凌晨 3 点执行，保留最近 7 天备份
# 用法：
#   1. 编辑 DB_NAME / BACKUP_DIR 为实际值
#   2. 设为可执行：chmod +x deploy/backup-mysql.sh
#   3. 加入 crontab：
#        0 3 * * * /path/to/action-agent-nest/deploy/backup-mysql.sh >> /var/log/jdi-mysql-backup.log 2>&1
#   4. 备份目录建议挂在独立磁盘或定期 rsync 到另一台机器

set -euo pipefail

# ── 请按实际环境修改 ──
DB_NAME="jdi"
DB_USER="root"
DB_PASS="${MYSQL_PASSWORD:-}"
DB_HOST="${MYSQL_HOST:-127.0.0.1}"
DB_PORT="${MYSQL_PORT:-3306}"
BACKUP_DIR="/var/backups/jdi-mysql"
RETAIN_DAYS=7
# ────────────────────

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="${BACKUP_DIR}/jdi_${TIMESTAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"

PASS_FLAG=""
if [ -n "$DB_PASS" ]; then
  PASS_FLAG="--password=${DB_PASS}"
fi

mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" $PASS_FLAG \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$OUTFILE"

# 删除旧备份
find "$BACKUP_DIR" -type f -name "jdi_*.sql.gz" -mtime +$RETAIN_DAYS -delete

echo "[$(date -Iseconds)] 备份完成: $OUTFILE"
