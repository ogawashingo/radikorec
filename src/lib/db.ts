import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// データベース接続設定
const defaultPath = path.join(process.cwd(), 'radikorec.db');
const dataPath = path.join(process.cwd(), 'data', 'radikorec.db');

const finalDbPath = process.env.DB_FILE_PATH
  ? process.env.DB_FILE_PATH
  : (fs.existsSync(dataPath) || fs.existsSync(path.join(process.cwd(), 'data')) ? dataPath : defaultPath);

const db = new Database(finalDbPath);

// データベーススキーマの初期化
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export const drizzleDb = drizzle(db, { schema });

// マイグレーション実行
try {
  migrate(drizzleDb, { migrationsFolder: './drizzle' });
  console.log('Database migrations completed successfully.');
} catch (error) {
  console.error('Database migration failed:', error);
}

