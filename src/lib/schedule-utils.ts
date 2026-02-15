/**
 * スケジュール予約の重複チェックに関するユーティリティ関数
 */

/**
 * 実効曜日と分（0:00からの分数）を表す型
 */
export interface EffectiveDayTime {
    dayOfWeek: number; // 0(日) - 6(土)
    minutesFromMidnight: number; // 0 - 1439
}



/**
 * ワンタイム予約の start_time からラジオ日表記（前日の24:00+）も含めた
 * 複数の EffectiveDayTime を返す。
 *
 * 例: 月曜00:00 → [月曜00:00, 日曜24:00*60=1440]
 * ただし分数は0-1439の範囲に収めたいので、ラジオ日表記は
 * (前日の曜日, 時刻+1440) として別途保持する。
 *
 * 実際にはマッチング関数側で「前日+1440分」パターンも試すことで対応する。
 */
export function getEffectiveDayTimesFromOneTime(startTime: string): EffectiveDayTime[] {
    const d = new Date(startTime);
    const dayOfWeek = d.getDay();
    const minutes = d.getHours() * 60 + d.getMinutes();

    const results: EffectiveDayTime[] = [
        { dayOfWeek, minutesFromMidnight: minutes },
    ];

    // 05:00未満の場合は前日の深夜番組（ラジオ日表記）としても扱う
    // 例: 月曜01:30 → 日曜25:30 (= 日曜 25*60+30 = 1530分)
    if (d.getHours() < 5) {
        results.push({
            dayOfWeek: (dayOfWeek - 1 + 7) % 7,
            minutesFromMidnight: (d.getHours() + 24) * 60 + d.getMinutes(),
        });
    }

    return results;
}

/**
 * 毎週予約の day_of_week と start_time（"HH:mm" 形式、24:00超えあり）から
 * 実効曜日と時刻を算出する。
 * 
 * 24:00超えの場合、正規化版（翌日00:00+）と生値の両方を返す。
 *
 * 例: day_of_week=1(月), start_time="24:00"
 *   → [{dayOfWeek:2, minutesFromMidnight:0}, {dayOfWeek:1, minutesFromMidnight:1440}]
 */
export function getEffectiveDayTimesFromWeekly(
    dayOfWeek: number,
    startTime: string
): EffectiveDayTime[] {
    const timePart = startTime.includes('T') ? startTime.split('T')[1] : startTime;
    const [h, m] = timePart.split(':').map(Number);

    const results: EffectiveDayTime[] = [];

    if (h >= 24) {
        // 深夜番組: 正規化版（翌日の通常時刻）
        results.push({
            dayOfWeek: (dayOfWeek + 1) % 7,
            minutesFromMidnight: (h - 24) * 60 + m,
        });
        // 生値（ラジオ日表記のまま: 前日の24:00+分数）
        results.push({
            dayOfWeek,
            minutesFromMidnight: h * 60 + m,
        });
    } else {
        results.push({
            dayOfWeek,
            minutesFromMidnight: h * 60 + m,
        });

        // 05:00未満の場合、前日24:00+としてもマッチできるようにする
        if (h < 5) {
            results.push({
                dayOfWeek: (dayOfWeek - 1 + 7) % 7,
                minutesFromMidnight: (h + 24) * 60 + m,
            });
        }
    }

    return results;
}

/**
 * 2つの EffectiveDayTime が同じ曜日・時刻かどうかを判定する
 * 週通算分数に変換して比較することで、日曜24:00と月曜00:00のようなケースも一致判定する。
 * toleranceMinutes: 許容する分単位の誤差（デフォルト5分）
 */
export function isDayTimeMatch(
    a: EffectiveDayTime,
    b: EffectiveDayTime,
    toleranceMinutes: number = 5
): boolean {
    const totalA = a.dayOfWeek * 1440 + a.minutesFromMidnight;
    const totalB = b.dayOfWeek * 1440 + b.minutesFromMidnight;

    // 一週間は 1440 * 7 = 10080 分
    const diff = Math.abs(totalA - totalB) % 10080;

    // 差が 0 または 10080 に近い場合は一致
    return diff <= toleranceMinutes || diff >= (10080 - toleranceMinutes);
}

/**
 * EffectiveDayTime の配列同士でいずれかの組み合わせがマッチするかを判定する
 */
export function isAnyDayTimeMatch(
    aList: EffectiveDayTime[],
    bList: EffectiveDayTime[],
    toleranceMinutes: number = 5
): boolean {
    for (const a of aList) {
        for (const b of bList) {
            if (isDayTimeMatch(a, b, toleranceMinutes)) return true;
        }
    }
    return false;
}


