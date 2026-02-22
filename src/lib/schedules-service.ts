import { drizzleDb } from '@/lib/db';
import { schedules } from '@/lib/schema';
import { sql } from 'drizzle-orm';
import {
    getEffectiveDayTimesFromOneTime,
    getEffectiveDayTimesFromWeekly,
    isAnyDayTimeMatch,
} from '@/lib/schedule-utils';

/**
 * クロスタイプの重複チェック（ワンタイム ↔ 毎週予約間の照合）
 * ラジオ日表記（前日24:00+）も考慮して、複数の表現でマッチングを行う。
 * 重複が見つかった場合、既存予約のタイトルを返す。なければ null。
 */
export function checkCrossTypeDuplicate(
    stationId: string,
    startTime: string,
    recurringPattern: string | null,
    dayOfWeek: number | null,
): string | null {
    if (recurringPattern === 'weekly' && dayOfWeek !== null) {
        // 毎週予約の作成 → 既存のワンタイム予約（pending）と照合
        const newDayTimes = getEffectiveDayTimesFromWeekly(dayOfWeek, startTime);

        const onetimeSchedules = drizzleDb.select({
            start_time: schedules.start_time,
            title: schedules.title,
        }).from(schedules).where(
            sql`${schedules.station_id} = ${stationId} AND ${schedules.recurring_pattern} IS NULL AND ${schedules.status} = 'pending'`
        ).all();

        for (const s of onetimeSchedules) {
            const existingDayTimes = getEffectiveDayTimesFromOneTime(s.start_time);
            if (isAnyDayTimeMatch(newDayTimes, existingDayTimes)) {
                return s.title || '無題の番組';
            }
        }
    } else {
        // ワンタイム予約の作成 → 既存の毎週予約と照合
        const newDayTimes = getEffectiveDayTimesFromOneTime(startTime);

        const weeklySchedules = drizzleDb.select({
            start_time: schedules.start_time,
            day_of_week: schedules.day_of_week,
            title: schedules.title,
        }).from(schedules).where(
            sql`${schedules.station_id} = ${stationId} AND ${schedules.recurring_pattern} = 'weekly'`
        ).all();

        for (const s of weeklySchedules) {
            if (s.day_of_week === null) continue;
            const existingDayTimes = getEffectiveDayTimesFromWeekly(s.day_of_week, s.start_time);
            if (isAnyDayTimeMatch(newDayTimes, existingDayTimes)) {
                return s.title || '無題の番組';
            }
        }
    }

    return null;
}

/**
 * 同型の重複チェック: 同じ放送局かつ開始時間が2分以内の予約が存在するか確認
 */
export function checkSameTypeDuplicate(stationId: string, startTime: string): boolean {
    const existing = drizzleDb.select({ id: schedules.id }).from(schedules)
        .where(sql`${schedules.station_id} = ${stationId} AND abs(strftime('%s', ${schedules.start_time}) - strftime('%s', ${startTime})) < 120`)
        .get();

    return !!existing;
}
