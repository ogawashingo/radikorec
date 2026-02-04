import { RadikoRecorder } from '../src/lib/recorder-core';
import path from 'path';

// Usage: npx tsx scripts/record_cli.ts <stationId> <durationMin> [outputFilename] [isRealtime]

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: npx tsx scripts/record_cli.ts <stationId> <durationMin> [outputFilename] [isRealtime:true|false]');
        process.exit(1);
    }

    const stationId = args[0];
    const durationMin = parseInt(args[1], 10);
    const outputFilename = args[2] || `manual_${stationId}_${Date.now()}.m4a`;
    const isRealtime = args[3] === 'true';

    const outputPath = path.resolve(process.cwd(), outputFilename);

    console.log(`--- 手動録音テスト ---`);
    console.log(`放送局: ${stationId}`);
    console.log(`時間: ${durationMin}分`);
    console.log(`保存先: ${outputPath}`);
    console.log(`モード: ${isRealtime ? 'リアルタイム' : 'タイムフリー'}`);
    console.log(`-------------------`);

    const recorder = new RadikoRecorder();

    // 現在時刻から開始
    const startTime = new Date();

    try {
        await recorder.record(stationId, startTime, durationMin, outputPath, isRealtime);
        console.log('録音完了しました。');
    } catch (error) {
        console.error('録音に失敗しました:', error);
        process.exit(1);
    }
}

main();
