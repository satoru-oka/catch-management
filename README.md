# catch-management ローカルセットアップ手順

## 構成

- **バックエンド**: FastAPI（Python）
- **フロントエンド**: Next.js（TypeScript / Tailwind CSS）
- **DB・認証・ストレージ**: Supabase

---

## 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/catch-management.git
cd catch-management
```

---

## 2. Supabase セットアップ

### 2-1. アカウント・プロジェクト作成

1. https://supabase.com にアクセスしてアカウント作成（GitHubログイン推奨）
2. 「New project」をクリック
   - Name: `catch-management`
   - Region: `Northeast Asia (Tokyo)`
   - Plan: Free

### 2-2. テーブル作成

管理画面の「SQL Editor」→「New query」に以下をまるごと貼り付けて「Run」：

```sql
-- ルアーマスターテーブル
CREATE TABLE lures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('ミノー', 'スプーン', 'スピナー', 'クランク', 'その他')),
  color TEXT,
  length_mm NUMERIC(5,1),
  weight_g NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ポイントテーブル
CREATE TABLE spots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  river_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 釣行テーブル
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  spot_id UUID REFERENCES spots(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  water_level TEXT CHECK (water_level IN ('低水', '平水', '増水', '大増水')),
  water_clarity TEXT CHECK (water_clarity IN ('クリア', 'ステイン', '笹濁り', '濁り')),
  weather TEXT CHECK (weather IN ('晴れ', '曇り', '雨', '雪')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 釣果テーブル
CREATE TABLE catches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  fish_species TEXT NOT NULL,
  length_cm NUMERIC(5,1),
  weight_g NUMERIC(7,1),
  lure_id UUID REFERENCES lures(id) ON DELETE SET NULL,
  lure_name TEXT,
  lure_color TEXT,
  caught_at TIMESTAMPTZ,
  is_released BOOLEAN DEFAULT TRUE,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security を有効化
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lures ENABLE ROW LEVEL SECURITY;

-- 自分のデータだけ操作できるポリシー
CREATE POLICY "spots_own" ON spots USING (auth.uid() = user_id);
CREATE POLICY "sessions_own" ON sessions USING (auth.uid() = user_id);
CREATE POLICY "lures_own" ON lures USING (auth.uid() = user_id);
CREATE POLICY "catches_own" ON catches
  USING (session_id IN (
    SELECT id FROM sessions WHERE user_id = auth.uid()
  ));
```

### 2-3. 認証設定

「Authentication」→「Providers」→「Email」→「Confirm email」を **OFF** に設定（開発中のみ）

### 2-4. テストユーザー作成

「Authentication」→「Users」→「Add user」でメールアドレスとパスワードを設定

### 2-5. APIキーの確認

「Project Settings」→「Data API」で以下をメモしておく：

- **Project URL**: `https://xxxx.supabase.co`
- **anon public key**: `eyJ...`（長い文字列）

---

## 3. バックエンド（FastAPI）セットアップ

### 3-1. 依存パッケージのインストール

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windowsは venv\Scripts\activate
pip install -r requirements.txt
```

### 3-2. 環境変数の設定

`backend/.env` を作成してSupabaseのキーを設定：

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=あなたのanon_key
```

> 認証はSupabaseが発行するユーザーJWTをFastAPIへBearerトークンで渡し、PostgRESTにそのまま流すことでRLSが効く構成です。`service_role` キーはバックエンドでは使用しません。

### 3-3. 起動

```bash
uvicorn main:app --reload
```

`http://localhost:8000/docs` でSwagger UIが表示されれば成功。

---

## 4. フロントエンド（Next.js）セットアップ

### 4-1. 依存パッケージのインストール

```bash
cd ../frontend
npm install
```

### 4-2. 環境変数の設定

`frontend/.env.local` を作成してSupabaseのキーを設定：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのanon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> ⚠️ `.env.local` は `.gitignore` に含まれているため、各自で作成が必要

### 4-3. 起動

```bash
npm run dev
```

`http://localhost:3000` でアプリが表示されれば成功。

---

## 5. 開発時の注意点

- **バックエンドとフロントエンドは別々のターミナルで起動する**
- **バックエンド**: `http://localhost:8000`（FastAPI）
- **フロントエンド**: `http://localhost:3000`（Next.js）
- `.env` 系ファイルを変更したらサーバーの再起動が必要
- `uvicorn --reload` はファイル保存時にサーバーを自動再起動するが、ブラウザは手動でリロードが必要