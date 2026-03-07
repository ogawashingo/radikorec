import { NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { records } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { transcribeAudio } from '@/lib/transcriber';
import path from 'path';
import fs from 'fs';
import { logger } from '@/lib/logger';

const RECORDS_DIR = path.join(process.cwd(), 'public', 'records');

/**
 * GET /api/records/transcribe?filename=xxx
 * 文字起こしのステータスと結果を返す
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');

    if (!filename) {
        return NextResponse.json({ error: 'filename は必須です' }, { status: 400 });
    }

    const record = drizzleDb.select({
        transcript: records.transcript,
        transcript_status: records.transcript_status,
    }).from(records).where(eq(records.filename, filename)).get();

    if (!record) {
        return NextResponse.json({ error: 'レコードが見つかりません' }, { status: 404 });
    }

    return NextResponse.json(record);
}

/**
 * POST /api/records/transcribe
 * Body: { filename: string }
 * 文字起こしを開始する（バックグラウンドで非同期実行）
 */
export async function POST(request: Request) {
    let filename: string;

    try {
        const body = await request.json();
        filename = body.filename;
    } catch {
        return NextResponse.json({ error: 'リクエストボディの解析に失敗しました' }, { status: 400 });
    }

    if (!filename) {
        return NextResponse.json({ error: 'filename は必須です' }, { status: 400 });
    }

    // DB のレコードを確認
    const record = drizzleDb.select().from(records).where(eq(records.filename, filename)).get();
    if (!record) {
        return NextResponse.json({ error: 'レコードが見つかりません' }, { status: 404 });
    }

    // 既に処理中の場合は 409
    if (record.transcript_status === 'processing') {
        return NextResponse.json({ error: '文字起こしは既に進行中です' }, { status: 409 });
    }

    // 音声ファイルの存在確認
    const audioPath = path.join(RECORDS_DIR, filename);
    if (!fs.existsSync(audioPath)) {
        return NextResponse.json({ error: '音声ファイルが見つかりません' }, { status: 404 });
    }

    // ステータスを processing に更新
    drizzleDb.update(records)
        .set({ transcript_status: 'processing', transcript: null })
        .where(eq(records.filename, filename))
        .run();

    const pythonPath = process.env.PYTHON_PATH || 'python3';
    logger.info({ filename, audioPath, pythonPath }, '文字起こしをバックグラウンドで開始します');

    // setImmediate でイベントループに乗せることで、レスポンス返却後も処理を継続させる
    setImmediate(async () => {
        try {
            const result = await transcribeAudio(audioPath);

            drizzleDb.update(records)
                .set({
                    transcript: result.fullText,
                    transcript_status: 'done',
                })
                .where(eq(records.filename, filename))
                .run();

            logger.info({ filename }, '文字起こしをDBに保存しました');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error({ filename, error: errorMsg }, '文字起こしに失敗しました');

            drizzleDb.update(records)
                .set({
                    transcript_status: 'error',
                    transcript: errorMsg,
                })
                .where(eq(records.filename, filename))
                .run();
        }
    });

    return NextResponse.json({ status: 'processing' });
}
