import { getDay, getHours, getMinutes, addMinutes } from 'date-fns';

function shouldTriggerWeekly(s: any, now: Date): boolean {
    const isRealtime = s.is_realtime === 1;
    let timePart = s.start_time;
    if (s.start_time.includes('T')) {
        timePart = s.start_time.split('T')[1];
    }
    const [startH, startM] = timePart.split(':').map(Number); // 例: "25:30" -> 25, 30

    // 過去2日から今日までの論理的な放送日をチェック (24時間を超える深夜放送をカバーするため)
    for (let dayOffset = -2; dayOffset <= 0; dayOffset++) {
        // offsetDayの深夜0時を基準とする
        const offsetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);

        // s.day_of_week と offsetDate の曜日が一致するか確認
        if (getDay(offsetDate) === s.day_of_week) {
            // 一致した場合、この日の論理的な開始時刻を作成
            const actualStartDate = new Date(offsetDate.getFullYear(), offsetDate.getMonth(), offsetDate.getDate(), startH, startM);

            if (isRealtime) {
                // リアルタイム: ちょうどその開始時刻になったら実行
                if (getHours(actualStartDate) === getHours(now) && getMinutes(actualStartDate) === getMinutes(now) && getDay(actualStartDate) === getDay(now)) {
                    return true;
                }
            } else {
                // タイムフリー: (開始 + 時間 + 5分) と一致したら実行
                const triggerDate = addMinutes(actualStartDate, s.duration + 5);
                if (getHours(triggerDate) === getHours(now) && getMinutes(triggerDate) === getMinutes(now) && getDay(triggerDate) === getDay(now)) {
                    return true;
                }
            }
        }
    }

    return false;
}

const nowFriday23_04 = new Date(2026, 1, 27, 23, 4); // 2026-02-27 23:04
const nowFriday23_05 = new Date(2026, 1, 27, 23, 5); // 2026-02-27 23:05
const nowSat00_05 = new Date(2026, 1, 28, 0, 5); // 2026-02-28 00:05

const testScheduleFriday23_30_timefree: any = {
    is_realtime: 0,
    start_time: '23:30',
    day_of_week: 5, // Friday
    duration: 30
};

console.log('Friday 23:30 + 30m Timefree at Fri 23:04:', shouldTriggerWeekly(testScheduleFriday23_30_timefree, nowFriday23_04)); // false
console.log('Friday 23:30 + 30m Timefree at Fri 23:05:', shouldTriggerWeekly(testScheduleFriday23_30_timefree, nowFriday23_05)); // false
console.log('Friday 23:30 + 30m Timefree at Sat 00:05:', shouldTriggerWeekly(testScheduleFriday23_30_timefree, nowSat00_05)); // true

const testScheduleSat24_30_realtime: any = {
    is_realtime: 1,
    start_time: '24:30',
    day_of_week: 6, // Saturday (technically Sunday 00:30)
    duration: 30
};
const nowSun00_30 = new Date(2026, 1, 29, 0, 30); // Sunday 00:30

console.log('Sat 24:30 Realtime at Sun 00:30:', shouldTriggerWeekly(testScheduleSat24_30_realtime, nowSun00_30)); // true
