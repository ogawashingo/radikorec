#!/usr/bin/env python3
"""
radiko録音ファイル 文字起こしスクリプト

通常モード（人間向け）:
  python3 scripts/transcribe.py <音声ファイル> [--model medium] [--max-minutes N]

JSONモード（TypeScriptからの呼び出し用）:
  python3 scripts/transcribe.py <音声ファイル> --json
"""

import argparse
import time
import sys
import os
import json

def main():
    parser = argparse.ArgumentParser(description='radiko録音ファイルを文字起こしします')
    parser.add_argument('audio_file', help='入力音声ファイルのパス (.m4a, .mp3, .aac など)')
    parser.add_argument('--model', default='medium', choices=['tiny', 'base', 'small', 'medium', 'large-v3'],
                        help='Whisperモデル (デフォルト: medium)')
    parser.add_argument('--max-minutes', type=float, default=None,
                        help='文字起こしする最大時間（分）。省略時は全体を処理')
    parser.add_argument('--json', action='store_true', dest='json_mode',
                        help='結果をJSON形式で stdout に出力（TypeScript連携用）')
    parser.add_argument('--no-save', action='store_true',
                        help='ファイルに保存せず、標準出力にのみ表示する（通常モードのみ）')
    parser.add_argument('--output', default=None,
                        help='出力テキストファイルのパス（省略時は同ディレクトリに .txt を生成）')
    args = parser.parse_args()

    if not os.path.exists(args.audio_file):
        if args.json_mode:
            print(json.dumps({'error': f'ファイルが見つかりません: {args.audio_file}'}))
        else:
            print(f'エラー: ファイルが見つかりません: {args.audio_file}', file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        msg = 'faster-whisper がインストールされていません。pip install faster-whisper を実行してください。'
        if args.json_mode:
            print(json.dumps({'error': msg}))
        else:
            print(f'エラー: {msg}', file=sys.stderr)
        sys.exit(1)

    # JSONモード以外はプログレスを表示
    if not args.json_mode:
        print(f'モデル: {args.model}（初回実行時はダウンロードが発生します）')
        print(f'入力ファイル: {args.audio_file}')
        print('モデルをロード中...')

    model = WhisperModel(args.model, device='cpu', compute_type='int8')

    if not args.json_mode:
        print('ロード完了\n')

    start = time.time()
    segments_iter, info = model.transcribe(args.audio_file, language='ja', beam_size=5)

    collected_segments = []
    lines = []

    for seg in segments_iter:
        # 最大時間でのカット
        if args.max_minutes is not None and seg.start > args.max_minutes * 60:
            break

        collected_segments.append({
            'start': seg.start,
            'end': seg.end,
            'text': seg.text.strip()
        })

        # 人間向け表示用
        start_m, start_s = divmod(int(seg.start), 60)
        end_m, end_s = divmod(int(seg.end), 60)
        line = f'[{start_m:02d}:{start_s:02d} - {end_m:02d}:{end_s:02d}] {seg.text.strip()}'
        lines.append(line)

        if not args.json_mode:
            print(line)

    elapsed = time.time() - start

    # JSONモード: TypeScriptへの返却
    if args.json_mode:
        result = {
            'segments': collected_segments,
            'language': info.language,
            'elapsed': round(elapsed, 1)
        }
        print(json.dumps(result, ensure_ascii=False))
        return

    # 通常モード: 処理時間と保存
    print(f'\n処理時間: {elapsed:.1f}秒')

    if not args.no_save:
        output_path = args.output or (os.path.splitext(args.audio_file)[0] + '.txt')
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'# 文字起こし: {os.path.basename(args.audio_file)}\n')
            f.write(f'# モデル: {args.model}\n')
            f.write(f'# 処理時間: {elapsed:.1f}秒\n\n')
            f.write('\n'.join(lines))
        print(f'\nテキストファイルに保存しました: {output_path}')

if __name__ == '__main__':
    main()
