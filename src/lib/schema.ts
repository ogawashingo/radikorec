import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const schedules = sqliteTable('schedules', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    station_id: text('station_id').notNull(),
    start_time: text('start_time').notNull(), // ISO 8601 or HH:mm
    end_time: text('end_time'),
    duration: integer('duration').notNull(),
    title: text('title'),
    recurring_pattern: text('recurring_pattern'), // "weekly" or null
    day_of_week: integer('day_of_week'), // 0=Sun...6=Sat
    status: text('status').default('pending').notNull(),
    error_message: text('error_message'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    is_realtime: integer('is_realtime').default(0).notNull(),
    retry_count: integer('retry_count').default(0).notNull(),
});

export const records = sqliteTable('records', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    filename: text('filename').notNull().unique(),
    station_id: text('station_id').notNull(),
    title: text('title'),
    start_time: text('start_time'),
    duration: integer('duration').notNull(),
    file_path: text('file_path'),
    size: integer('size').notNull(),
    is_watched: integer('is_watched').default(0).notNull(),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const keywords = sqliteTable('keywords', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    keyword: text('keyword').notNull(),
    enabled: integer('enabled').default(1).notNull(),
    prevent_duplicates: integer('prevent_duplicates').default(1).notNull(),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});
