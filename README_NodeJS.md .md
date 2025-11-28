# 入力システム（Node.js版）- セットアップガイド

このシステムは、Python不要でNode.jsのみで動作する入力管理システムです。

## 📋 機能概要

### ユーザー向け機能
- 項目を選択して入力
- 入力内容の確認
- 個別PDFのダウンロード

### メイン管理者向け機能
- Excelファイルのアップロードによる構造定義
- サブ管理者アカウントの作成・削除
- パスワード管理
- 全データの統合PDF生成
- 全入力データの閲覧

### サブ管理者向け機能
- 統合PDFのダウンロード
- 入力データ一覧の閲覧
- 各項目のPDFダウンロード

## 🚀 セットアップ手順

### 1. 必要な環境

- **Node.js** v14以上（推奨: v18以上）
- **npm**（Node.jsに含まれています）

Node.jsがインストールされていない場合:
- Windows/Mac: https://nodejs.org/ からダウンロード
- Linux: `sudo apt install nodejs npm` または `brew install node`

確認方法:
```bash
node --version
npm --version
```

### 2. プロジェクトのセットアップ

```bash
# プロジェクトフォルダに移動
cd input-system

# 依存パッケージのインストール
npm install
```

### 3. ディレクトリ構造

以下のディレクトリ構造を作成してください：

```
input-system/
├── server.js              # メインサーバー
├── package.json           # 依存関係定義
├── README_NodeJS.md       # このファイル
├── public/                # 静的ファイル
│   ├── index.html         # ユーザー入力画面
│   ├── admin.html         # メイン管理者画面
│   └── sub_admin.html     # サブ管理者画面
├── database/              # データベース（自動作成）
│   ├── users.json         # ユーザー情報
│   ├── inputs.json        # 入力データ
│   └── structure.json     # フォーム構造
├── uploads/               # アップロードファイル（自動作成）
└── pdf_output/            # PDF出力（自動作成）
```

### 4. HTMLファイルの配置

`public/`フォルダを作成し、以下の3つのHTMLファイルを配置してください：
- `index.html` - ユーザー入力画面
- `admin.html` - メイン管理者画面
- `sub_admin.html` - サブ管理者画面

これらのファイルは前回作成したHTMLファイルをそのまま使用できます。

### 5. アプリケーションの起動

```bash
# 通常起動
npm start

# 開発モード（ファイル変更時に自動再起動）
npm run dev
```

起動すると以下のメッセージが表示されます：
```
サーバーが起動しました: http://localhost:5000
ユーザー画面: http://localhost:5000/
管理者画面: http://localhost:5000/admin
サブ管理者画面: http://localhost:5000/sub-admin
```

### 6. アクセス

ブラウザで以下のURLにアクセスしてください：

- **ユーザー入力画面**: http://localhost:5000/
- **メイン管理者画面**: http://localhost:5000/admin
- **サブ管理者画面**: http://localhost:5000/sub-admin

## 🔐 初期ログイン情報

### メイン管理者
- **ユーザー名**: `main_admin`
- **パスワード**: `admin123`

⚠️ **セキュリティ上の注意**: 初回ログイン後、必ずパスワードを変更してください！

## 📝 使用方法

### Node.jsとPython版の違い

| 項目 | Node.js版 | Python版 |
|------|-----------|----------|
| 実行環境 | Node.js | Python |
| パッケージ管理 | npm | pip |
| 起動コマンド | `npm start` | `python app.py` |
| 主な依存 | Express, xlsx | Flask, openpyxl |

### メイン管理者の操作

使用方法はPython版と同じです：

1. **ログイン**: http://localhost:5000/admin にアクセス

2. **構造管理タブ**:
   - Excelファイルをアップロード
   - 現在の構造を確認

3. **ユーザー管理タブ**:
   - サブ管理者アカウントを作成
   - パスワード変更・削除

4. **データ閲覧タブ**:
   - 統合PDFダウンロード
   - 個別データ確認

## 🔧 カスタマイズ

### セキュリティ設定

`server.js`の以下の行を変更してください：

```javascript
app.use(session({
    secret: 'change-this-secret-key-in-production',
    // ...
}));
```

### ポート番号の変更

環境変数で設定：
```bash
# Windows
set PORT=8080
npm start

# Mac/Linux
PORT=8080 npm start
```

または`server.js`の最終行を編集：
```javascript
const PORT = process.env.PORT || 5000;
```

## 🐛 トラブルシューティング

### パッケージインストールエラー

```bash
# キャッシュをクリア
npm cache clean --force

# 再インストール
rm -rf node_modules package-lock.json
npm install
```

### ポートが既に使用されている

```bash
# Windows
netstat -ano | findstr :5000

# Mac/Linux
lsof -i :5000
```

プロセスを終了するか、別のポートを使用してください。

### PDFの日本語が文字化け

PDFKitは日本語フォントの追加設定が必要です。`server.js`のPDF生成部分を以下のように修正：

```javascript
// 日本語フォントの登録（フォントファイルが必要）
doc.font('path/to/japanese-font.ttf');
```

### データベースファイルのリセット

```bash
# databaseフォルダを削除
rm -rf database

# サーバー再起動で自動再作成
npm start
```

## 📦 本番環境へのデプロイ

### 1. PM2を使った永続化

```bash
# PM2のインストール
npm install -g pm2

# アプリケーション起動
pm2 start server.js --name "input-system"

# 自動起動設定
pm2 startup
pm2 save
```

### 2. Nginxでリバースプロキシ設定

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 環境変数の設定

`.env`ファイルを作成：
```
PORT=5000
SESSION_SECRET=your-super-secret-key-here
NODE_ENV=production
```

`server.js`で読み込み：
```javascript
require('dotenv').config();

app.use(session({
    secret: process.env.SESSION_SECRET,
    // ...
}));
```

### 4. HTTPS化

Let's Encryptで無料SSL証明書を取得：
```bash
sudo certbot --nginx -d yourdomain.com
```

## 💡 Node.js版のメリット

1. **シンプルな環境**: Node.jsだけでOK（Pythonのインストール不要）
2. **高速**: 非同期処理で高いパフォーマンス
3. **豊富なパッケージ**: npmエコシステムの活用
4. **スケーラブル**: PM2でクラスタリング可能
5. **クロスプラットフォーム**: Windows/Mac/Linuxで同じコードが動作

## 📊 パフォーマンス最適化

### ファイルアップロードの制限

```javascript
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
```

### セッションストアの変更（Redis使用）

```javascript
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const redisClient = redis.createClient();

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: 'your-secret',
    // ...
}));
```

## 🔄 アップデート

新しいパッケージのインストール：
```bash
npm update
```

セキュリティの脆弱性チェック：
```bash
npm audit
npm audit fix
```

## 📞 サポート

問題が発生した場合：
1. Node.jsとnpmのバージョンを確認
2. `npm install`で依存関係を再インストール
3. エラーログを確認（コンソールに出力されます）

## 🎯 次のステップ

- [ ] 本番環境用のセキュリティ設定
- [ ] データベースをMongoDBやPostgreSQLに移行
- [ ] メール通知機能の追加
- [ ] ファイル添付機能の実装
- [ ] レスポンシブデザインの改善
