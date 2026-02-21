import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../lib/schema';
import { eq } from 'drizzle-orm';

describe('Drizzle ORM Integration Tests', () => {
    let sqlite: Database.Database;
    let db: BetterSQLite3Database<typeof schema>;

    beforeAll(() => {
        // Use in-memory database for testing
        sqlite = new Database(':memory:');
        db = drizzle(sqlite, { schema });

        // Manually run migration or push schema
        // Since we don't have migration files yet, we can use `push` logic or just create tables manually for testing
        // For simplicity in this test, we'll mimic the schema creation
        sqlite.exec(`
            CREATE TABLE IF NOT EXISTS schedules (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              station_id TEXT NOT NULL,
              start_time TEXT NOT NULL,
              end_time TEXT,
              duration INTEGER,
              title TEXT,
              recurring_pattern TEXT,
              day_of_week INTEGER,
              status TEXT DEFAULT 'pending',
              error_message TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              is_realtime INTEGER DEFAULT 0,
              retry_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              filename TEXT NOT NULL UNIQUE,
              station_id TEXT,
              title TEXT,
              start_time TEXT,
              duration INTEGER,
              file_path TEXT,
              size INTEGER,
              is_watched INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS keywords (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              keyword TEXT NOT NULL,
              enabled INTEGER DEFAULT 1,
              prevent_duplicates INTEGER DEFAULT 1,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
    });

    afterAll(() => {
        sqlite.close();
    });

    test('should insert and select a keyword', () => {
        const keyword = 'Test Keyword';
        db.insert(schema.keywords).values({ keyword }).run();

        const result = db.select().from(schema.keywords).where(eq(schema.keywords.keyword, keyword)).all();
        expect(result).toHaveLength(1);
        expect(result[0].keyword).toBe(keyword);
    });

    test('should insert and select a schedule', () => {
        const schedule = {
            station_id: 'TBS',
            start_time: '2023-01-01T00:00:00Z',
            duration: 60,
            title: 'Test Program'
        };
        db.insert(schema.schedules).values(schedule).run();

        const result = db.select().from(schema.schedules).where(eq(schema.schedules.station_id, 'TBS')).all();
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Test Program');
    });

    test('should insert and select a record', () => {
        const record = {
            filename: 'test_file.m4a',
            station_id: 'LFR',
            title: 'Recorded Program',
            duration: 120,
            file_path: '/path/to/file',
            size: 1024
        };
        db.insert(schema.records).values(record).run();

        const result = db.select().from(schema.records).where(eq(schema.records.filename, 'test_file.m4a')).all();
        expect(result).toHaveLength(1);
        expect(result[0].station_id).toBe('LFR');
    });
});
