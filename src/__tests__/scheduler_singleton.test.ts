import { initScheduler } from '../lib/scheduler';
import cron from 'node-cron';
import { logger } from '../lib/logger';

// モック化
jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

jest.mock('../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

// DBなどの依存を回避するために、モジュールロード時に実行される部分をケアする必要があるが、
// scheduler.ts のトップレベルでは import しかしていないので、
// initScheduler を呼ぶまでは副作用はないはず... と思いきや、
// scheduler.ts 内で `drizzleDb` などを import しているため、
// それらの依存先もモック化する必要があるかもしれない。
// 一旦最小限のモックで試す。

jest.mock('../lib/db', () => ({
    drizzleDb: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        all: jest.fn().mockReturnValue([]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        run: jest.fn(),
    }
}));

jest.mock('../lib/schema', () => ({
    schedules: {},
}));

describe('Scheduler Singleton', () => {
    beforeEach(() => {
        // テストごとにグローバル変数をリセット
        globalThis.isSchedulerRunning = undefined;
        jest.clearAllMocks();
        // console.log をスパイ
        jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('initScheduler should only run once', () => {
        // 1回目の実行
        initScheduler();

        expect(globalThis.isSchedulerRunning).toBe(true);
        expect(logger.info).toHaveBeenCalledWith('Starting Scheduler...');
        expect(cron.schedule).toHaveBeenCalledTimes(2); // 04:00 scan + 1min trigger

        // 2回目の実行
        initScheduler();

        // 2回目はログ出力されず、cron.scheduleも増えないはず
        // ただし "Scheduler already running" のログは出る
        expect(console.log).toHaveBeenCalledWith('Scheduler already running (skipping re-init).');

        // logger.info は増えていないはず
        expect(logger.info).toHaveBeenCalledTimes(1);

        // cron.schedule も増えていないはず
        expect(cron.schedule).toHaveBeenCalledTimes(2);
    });
});
