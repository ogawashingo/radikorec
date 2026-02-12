import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Docker環境等のためのパス設定
// 環境変数 DB_FILE_PATH があればそれを、なければカレントディレクトリ(またはdataディレクトリ)を探す
const DB_PATH = process.env.DB_FILE_PATH || path.join(process.cwd(), 'data', 'radikorec.db');

// ※ ローカル開発で data/ がない場合のフォールバックロジックが必要なら追加するが、
// シンプルにするため、ローカルでも data/radikorec.db に置くか、
// あるいは process.cwd()/radikorec.db をデフォルトにするか。
// ここでは Docker化に伴い /app/data/radikorec.db を標準とするため、
// ローカルでも data ディレクトリを作ってもらう方が綺麗。
// ただし、既存互換性のため fs.existsSync で分岐する。

const defaultPath = path.join(process.cwd(), 'radikorec.db');
const dataPath = path.join(process.cwd(), 'data', 'radikorec.db');

const finalDbPath = process.env.DB_FILE_PATH
  ? process.env.DB_FILE_PATH
  : (fs.existsSync(dataPath) || fs.existsSync(path.join(process.cwd(), 'data')) ? dataPath : defaultPath);

const db = new Database(finalDbPath);

// データベーススキーマの初期化
// Drizzle instance creation
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export const drizzleDb = drizzle(db, { schema });

// Run migrations on startup
try {
  migrate(drizzleDb, { migrationsFolder: './drizzle' });
  console.log('Database migrations completed successfully.');
} catch (error) {
  console.error('Database migration failed:', error);
}

