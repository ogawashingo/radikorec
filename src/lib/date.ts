/**
 * タイムゾーンや深夜帯（24:00以降）の表示を考慮した日時フォーマット関数群
 */

export const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 予約された日時文字列（例: "2024-01-01 01:00"）を受け取り、
 * 5時未満（深夜番組帯）なら前日の24時間+の表現（例: "25:00"）に変換してフォーマットします。
 *
 * @param dateString 日時を示す文字列（Date.parse可能なもの）
 * @returns フォーマットされた日時文字列（例: "12/31 (日) 25:00"）
 */
export function formatToLateNightTime(dateString: string | null | undefined): string {
    if (!dateString) return '';

    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    let displayH = d.getHours();
    let displayD = new Date(d);

    // 午前0時〜午前4時の場合は「前日の24時間超え」として表示（例: 25:00等）
    if (displayH < 5) {
        displayH += 24;
        displayD.setDate(d.getDate() - 1);
    }

    const month = displayD.getMonth() + 1;
    const date = displayD.getDate();
    const dayName = DAYS_OF_WEEK[displayD.getDay()];

    // 0パディング（例: 25 -> "25", 5 -> "05"）
    const mm = String(d.getMinutes()).padStart(2, '0');
    // 時の部分は 25 などが入る可能性があるが通常は2桁、とりあえずそのまま出す
    const hh = String(displayH).padStart(2, '0');

    return `${month}/${date} (${dayName}) ${hh}:${mm}`;
}
