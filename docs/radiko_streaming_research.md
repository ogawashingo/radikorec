# Radiko ストリーミング配信の仕組み調査結果 (2026/02/16)

radikoのストリーミングAPIから取得できる配信URLの構成と、各ドメインの役割についての調査

## 配信ドメインの分類

radikoは主に2つの配信基盤を併用しており、それぞれ異なるドメインを使用している

### 1. SmartSTREAM (NTTスマートコネクト)
メイン配信基盤と思われる。用途ごとにサブドメインが明確に分かれている

- **`si-f-radiko.smartstream.ne.jp`**
  - **推測:** **Si**mulcast **F**ree
  - **用途:** 通常ライブ放送（エリア内）
- **`si-c-radiko.smartstream.ne.jp`**
  - **推測:** **Si**mulcast **C**harged
  - **用途:** エリアフリーライブ放送（ラジコプレミアム）
- **`tf-f-rpaa-radiko.smartstream.ne.jp`**
  - **推測:** **T**ime **F**ree **F**ree / RPAA?
  - **用途:** タイムフリー（通常・エリア内）
- **`tf-c-rpaa-radiko.smartstream.ne.jp`**
  - **推測:** **T**ime **F**ree **C**harged / RPAA?
  - **用途:** タイムフリー（エリアフリー）

### 2. Cloudflare / Wowza (`radiko-cf.com`)
安定性を重視した配信基盤と思われる。CDN (Content Delivery Network) としてCloudflareを利用している可能性が高い。

- **`dr-wowza.radiko-cf.com`**
  - **特徴:** 全ての条件（ライブ/タイムフリー、エリア内/エリアフリー）で共通して提供されているURLドメイン
  - **メリット:** CDNを経由しているため、地域による遅延差が少なく、配信が安定している傾向

## 現行システムの実装方針

`src/lib/radiko.ts` では、取得したURLリストから **`dr-wowza` を含むURLを汎用的かつ安定した配信元として判断し優先的に選択** するように実装済。

## radikoオーディオアドについて

radikoでは、放送番組内の特定の広告枠において、**radikoオーディオアド** と呼ばれる仕組みが導入されている
これは、ユーザーの属性（位置情報、年代、性別、過去の聴取履歴など）に基づいて、個別に最適化された広告をリアルタイムに配信サーバー側で差し込む技術（Server-Side Ad Insertion）。

この仕組みにより、同じ放送局の同じ番組を聴取していても、聴取しているユーザーによって流れるCMの内容が異なる場合がある。したがって、録音されたデータにも「そのユーザー向けにパーソナライズされたCM」が含まれることになる。

### 参考文献

- [総務省: 放送コンテンツの製作・流通の促進等に関する現状・課題について](https://www.soumu.go.jp/main_content/001039552.pdf)
- [radiko business（広告主向け情報）](https://biz.radiko.jp/)
