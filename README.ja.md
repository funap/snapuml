# SnapUML ⚡

Web ブラウザ上で動作する、超高速・完全クライアントサイド・ローカルファーストな PlantUML 風ダイアグラムジェネレーター。

[English](README.md) | **日本語**

**[✨ ライブデモを試す！](https://funap.github.io/snapuml/)**

---

## 🌟 なぜ SnapUML なのか？

PlantUML は「ダイアグラムをコードとして記述する（Diagrams as Code）」業界標準の素晴らしいツールとして、世界中の開発者に愛用されています。

**SnapUML は、その直感的で親しみやすい PlantUML 風の記述体験を、モダンな Web ブラウザ上に直接もたらします。** 完全クライアントサイドで構文解析とレンダリングを行う軽量かつ外部依存ゼロのコンパイラであり、Web アプリケーション、個人ブログ、社内 Wiki などへのインタラクティブなダイアグラム埋め込みが非常に簡単に行えます。

### 主なメリット:

- **✍️ 直感的な PlantUML 風シンタックス**: 広く親しまれている明快で表現力豊かな記法で、シーケンス図やコンポーネント図を作成できます。
- **🔒 設計レベルでのプライバシーとセキュリティ**: 解析とレンダリングのすべての処理がユーザーのブラウザ内でローカルに実行されるため、アーキテクチャ情報やコードが外部マシンに送信されることは一切ありません。
- **⚡ リアルタイムなローカル描画**: ネットワーク遅延やサーバーとの往復通信なしに、入力と同時に瞬時にプレビューを生成します。
- **📦 外部依存ゼロ**: Java ランタイムも Graphviz のインストールもバックエンドサーバーも不要です。純粋で軽量な TypeScript / JavaScript のみで構成されています。
- **📶 オフライン対応**: 100% クライアントサイドで動作するため、インターネット接続がない環境でも、いつでもどこでも図の生成と表示が可能です。

---

## 🚀 主な機能

- **PlantUML 風シンタックス**: 素早く作図できるよう最適化された、慣れ親しんだ宣言的構文。
- **サポートしているダイアグラム**:
  - **シーケンス図 (Sequence Diagrams)**: アクター、参加者 (participant)、バウンダリ、制御フロー (alt, loop, group 等) に対応
  - **コンポーネント図 (Component Diagrams)**: コンポーネント、インターフェース、データベース、パッケージ構造に対応
- **インライン自動レンダリング**: Web ページ上のコードブロックを簡単に埋め込み・自動描画可能。
- **優れたポータビリティ**: 軽量な ES Module または IIFE スクリプトとして手軽に組み込み可能。

---

## 🛠️ クイックスタート

### 1. ブラウザでの利用 (HTML 連携)

ビルド済みのスクリプトを読み込んで初期化するだけです。SnapUML がページ内の `<pre class="snapuml">` ブロックを自動的にスキャンし、インタラクティブな SVG ダイアグラムへと瞬時に変換します。

```html
<!-- SnapUML の読み込み -->
<script src="dist/snapuml.min.js"></script>

<!-- 自動レンダリングの初期化 -->
<script>
  snapuml.initialize();
</script>

<!-- プレーンテキストでダイアグラムを記述 -->
<pre class="snapuml">
participant User
participant API
database DB

User -> API: GET /users
API -> DB: Query User
DB --> API: User Data
API --> User: 200 OK (JSON)
</pre>
```

### 2. NPM / ES Module での利用

```typescript
import snapuml from 'snapuml';

const code = `
[Component A] -> [Component B] : API Request
`;

// SVG 文字列としてレンダリング
const svgString = snapuml.render(code);
```

---

## 💻 開発とビルド

### 前提条件
- **Node.js** (v18.0.0 以上推奨)
- **npm**

### インストール

```bash
npm install
```

### 配信用バンドルのビルド

`dist/` ディレクトリ配下にブラウザ用バンドル、圧縮版 (minified)、ES Module を生成します:

```bash
npm run build
```

以下が出力されます:
- `dist/snapuml.js` - ブラウザ用 IIFE バンドル
- `dist/snapuml.min.js` - ブラウザ用 IIFE 圧縮版バンドル
- `dist/snapuml.esm.mjs` - ES Module バンドル
- `dist/snapuml.esm.min.mjs` - ES Module 圧縮版バンドル

### 型チェック

```bash
npm run type-check
```

### テストの実行

デプロイ前にテストを実行して安全性を確認します:

```bash
npm run test
```

---

## 📄 ライセンス

本プロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

