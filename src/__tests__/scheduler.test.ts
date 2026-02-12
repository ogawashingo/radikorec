import { shouldTrigger, shouldTriggerWeekly } from '../lib/scheduler';
import { Schedule } from '../types';

// テスト用のスケジュールヘルパー関数
function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
    return {
        id: 1,
        station_id: 'TBS',
        start_time: '2026-02-12T10:00',
        end_time: null,
        duration: 30,
        title: 'テスト番組',
        recurring_pattern: null,
        day_of_week: null,
        status: 'pending',
        error_message: null,
        created_at: '2026-02-12T00:00:00',
        is_realtime: 0,
        retry_count: 0,
        ...overrides,
    } as Schedule;
}

describe('shouldTrigger（ワンタイム予約）', () => {
    describe('リアルタイム録音', () => {
        test('開始時刻以前であれば true を返す', () => {
            const s = makeSchedule({ is_realtime: 1, start_time: '2026-02-12T10:00' });
            const now = new Date(2026, 1, 12, 10, 0); // 2026-02-12 10:00
            expect(shouldTrigger(s, now)).toBe(true);
        });

        test('開始時刻より後でも true を返す（DB側のクエリで制御済み）', () => {
            const s = makeSchedule({ is_realtime: 1, start_time: '2026-02-12T09:00' });
            const now = new Date(2026, 1, 12, 10, 0);
            expect(shouldTrigger(s, now)).toBe(true);
        });
    });

    describe('タイムフリー録音', () => {
        test('番組終了+5分後のタイミングで true を返す', () => {
            // 10:00開始、30分番組 → 終了10:30 → トリガー10:35
            const s = makeSchedule({ is_realtime: 0, start_time: '2026-02-12T10:00', duration: 30 });
            const now = new Date(2026, 1, 12, 10, 35);
            expect(shouldTrigger(s, now)).toBe(true);
        });

        test('番組終了+5分前では false を返す', () => {
            const s = makeSchedule({ is_realtime: 0, start_time: '2026-02-12T10:00', duration: 30 });
            const now = new Date(2026, 1, 12, 10, 34);
            expect(shouldTrigger(s, now)).toBe(false);
        });

        test('番組終了+7分後（ウィンドウ外）では false を返す', () => {
            const s = makeSchedule({ is_realtime: 0, start_time: '2026-02-12T10:00', duration: 30 });
            const now = new Date(2026, 1, 12, 10, 37);
            expect(shouldTrigger(s, now)).toBe(false);
        });

        test('番組終了+6分後（ウィンドウ内: diff < 2）では true を返す', () => {
            const s = makeSchedule({ is_realtime: 0, start_time: '2026-02-12T10:00', duration: 30 });
            const now = new Date(2026, 1, 12, 10, 36);
            expect(shouldTrigger(s, now)).toBe(true);
        });
    });
});

describe('shouldTriggerWeekly（毎週予約）', () => {
    describe('リアルタイム録音', () => {
        test('当日の開始時刻ちょうどで true を返す', () => {
            // 2026-02-12 は木曜日 (day_of_week = 4)
            const s = makeSchedule({
                is_realtime: 1,
                recurring_pattern: 'weekly',
                start_time: '21:00',
                day_of_week: 4,
                duration: 60,
            });
            const now = new Date(2026, 1, 12, 21, 0); // 木曜 21:00
            expect(shouldTriggerWeekly(s, now)).toBe(true);
        });

        test('当日だが時刻が異なれば false を返す', () => {
            const s = makeSchedule({
                is_realtime: 1,
                recurring_pattern: 'weekly',
                start_time: '21:00',
                day_of_week: 4,
                duration: 60,
            });
            const now = new Date(2026, 1, 12, 21, 1); // 木曜 21:01
            expect(shouldTriggerWeekly(s, now)).toBe(false);
        });

        test('曜日が異なれば false を返す', () => {
            const s = makeSchedule({
                is_realtime: 1,
                recurring_pattern: 'weekly',
                start_time: '21:00',
                day_of_week: 3, // 水曜
                duration: 60,
            });
            const now = new Date(2026, 1, 12, 21, 0); // 木曜
            expect(shouldTriggerWeekly(s, now)).toBe(false);
        });
    });

    describe('タイムフリー録音', () => {
        test('番組終了+5分後のタイミングで true を返す', () => {
            // 21:00開始、60分番組 → 終了22:00 → トリガー22:05
            const s = makeSchedule({
                is_realtime: 0,
                recurring_pattern: 'weekly',
                start_time: '21:00',
                day_of_week: 4,
                duration: 60,
            });
            const now = new Date(2026, 1, 12, 22, 5); // 木曜 22:05
            expect(shouldTriggerWeekly(s, now)).toBe(true);
        });

        test('トリガー時刻でなければ false を返す', () => {
            const s = makeSchedule({
                is_realtime: 0,
                recurring_pattern: 'weekly',
                start_time: '21:00',
                day_of_week: 4,
                duration: 60,
            });
            const now = new Date(2026, 1, 12, 22, 4); // 木曜 22:04（1分早い）
            expect(shouldTriggerWeekly(s, now)).toBe(false);
        });
    });

    describe('深夜番組（25時超え）', () => {
        test('前日のday_of_weekで25:00の番組が翌日1:00にトリガーされる', () => {
            // 水曜(3) 25:00 = 木曜(4) 01:00
            const s = makeSchedule({
                is_realtime: 1,
                recurring_pattern: 'weekly',
                start_time: '25:00',
                day_of_week: 3, // 水曜
                duration: 30,
            });
            const now = new Date(2026, 1, 12, 1, 0); // 木曜 01:00
            expect(shouldTriggerWeekly(s, now)).toBe(true);
        });

        test('当日のday_of_weekで25:00の番組は当日にはトリガーされない', () => {
            // 木曜(4) 25:00 は金曜に実行されるべき
            const s = makeSchedule({
                is_realtime: 1,
                recurring_pattern: 'weekly',
                start_time: '25:00',
                day_of_week: 4, // 木曜
                duration: 30,
            });
            const now = new Date(2026, 1, 12, 1, 0); // 木曜 01:00
            expect(shouldTriggerWeekly(s, now)).toBe(false);
        });
    });
});
