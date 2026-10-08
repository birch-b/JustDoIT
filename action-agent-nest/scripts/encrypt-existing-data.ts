// 一次性迁移脚本：把数据库里既有的明文内容字段加密为 enc:v1 密文
// 幂等可重复运行（只处理不带 enc:v1: 前缀的非空值）；运行前确保 DATA_ENCRYPTION_KEY 已配置
// 用法：npm run encrypt:data
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { encryptText } from '../src/common/crypto/field-crypto';

/** 需要加密的 表.列 清单（与实体上挂 encryptedTransformer 的字段保持一致） */
const TARGETS: Array<{ table: string; column: string }> = [
  { table: 'task', column: 'taskContent' },
  { table: 'task', column: 'extraContext' },
  { table: 'task_session', column: 'conclusion' },
  { table: 'task_session', column: 'persuadeText' },
  { table: 'task_session', column: 'minAction' },
  { table: 'task_session', column: 'tarotReading' },
  { table: 'task_session', column: 'answerBook' },
  { table: 'task_session', column: 'answerBookReading' },
  { table: 'action_record', column: 'executeResult' },
  { table: 'action_record', column: 'feedbackComment' },
  { table: 'action_record', column: 'agentReply' },
  { table: 'user_memory', column: 'content' },
  { table: 'todo', column: 'taskContent' },
];

async function main() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT!, 10),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  await ds.initialize();

  let total = 0;
  for (const { table, column } of TARGETS) {
    const rows: Array<{ id: number; val: string | null }> = await ds.query(
      `SELECT id, \`${column}\` AS val FROM \`${table}\`
       WHERE \`${column}\` IS NOT NULL AND \`${column}\` != '' AND \`${column}\` NOT LIKE 'enc:v1:%'`,
    );
    for (const row of rows) {
      await ds.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`, [
        encryptText(row.val as string),
        row.id,
      ]);
    }
    if (rows.length) console.log(`${table}.${column}: 加密 ${rows.length} 行`);
    total += rows.length;
  }

  await ds.destroy();
  console.log(`迁移完成，共加密 ${total} 个字段值`);
}

main().catch((e) => {
  console.error('迁移失败:', e);
  process.exit(1);
});
