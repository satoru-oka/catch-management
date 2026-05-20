# Database Setup

Supabase プロジェクト、開発用 schema、RLS ポリシー、結合テスト用プロジェクトの準備手順です。

このプロジェクトは Supabase Auth が発行したユーザー JWT を FastAPI が受け取り、その JWT を PostgREST に中継して PostgreSQL の Row Level Security に認可を任せます。Backend runtime では `service_role` key を使いません。

## 開発用 Supabase プロジェクト

1. [Supabase](https://supabase.com) にログインする。
2. `New project` を作成する。
   - Name: `catch-management`
   - Region: `Northeast Asia (Tokyo)` など近い region
   - Plan: Free で可
3. Authentication -> Providers -> Email で、開発中は `Confirm email` を OFF にする。
4. Project Settings -> API で以下を確認する。
   - Project URL
   - anon public key

## Schema

Supabase Dashboard の SQL Editor で以下を実行します。

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
```

## Row Level Security

```sql
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spots_own" ON spots
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_own" ON sessions
  USING (auth.uid() = user_id);

CREATE POLICY "lures_own" ON lures
  USING (auth.uid() = user_id);

CREATE POLICY "catches_own" ON catches
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );
```

## Stats views

統計 API は以下の view を優先して読みます。どちらも `security_invoker = true` を付け、呼び出し元ユーザーの RLS を維持します。既存環境で view が未作成の場合、Backend は互換 fallback として従来の Python 集計に戻ります。

```sql
CREATE OR REPLACE VIEW user_monthly_session_stats
WITH (security_invoker = true) AS
SELECT
  to_char(s.date, 'YYYY-MM') AS month,
  COUNT(DISTINCT s.id) AS session_count,
  COUNT(c.id) AS catch_count
FROM sessions s
LEFT JOIN catches c ON c.session_id = s.id
GROUP BY to_char(s.date, 'YYYY-MM');

CREATE OR REPLACE VIEW user_lure_stats
WITH (security_invoker = true) AS
SELECT
  COALESCE(NULLIF(lure_name, ''), '不明') AS lure_name,
  COUNT(*) AS count,
  ROUND(AVG(length_cm)::numeric, 1) AS avg_length
FROM catches
GROUP BY COALESCE(NULLIF(lure_name, ''), '不明');
```

## 開発用ユーザー

Authentication -> Users -> Add user から、開発用のメールアドレスとパスワードを作成します。フロントエンドの `/login` からそのユーザーでログインできます。

## Backend env

`backend/.env.example` を `backend/.env` にコピーして値を入れます。

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

ALLOWED_ORIGINS=http://localhost:3000
```

`SUPABASE_JWT_SECRET` は Project Settings -> API -> JWT Secret から取得します。設定すると Backend がユーザー JWT をローカル検証し、リクエストごとの Supabase Auth API 呼び出しを避けます。未設定の場合は互換性のため Supabase Auth API による検証へ fallback します。

`ALLOWED_ORIGINS` は comma-separated で複数指定できます。

```env
ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
```

## Frontend env

`frontend/.env.local` を作成して値を入れます。

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 結合テスト用 Supabase プロジェクト

`backend/tests/integration/` は実 Supabase に接続して Auth、RLS、PostgREST の境界を検証します。本番や普段の開発用プロジェクトではなく、テスト専用プロジェクトを使ってください。

1. Supabase Dashboard でテスト専用プロジェクトを作成する。
2. このドキュメントの schema と RLS SQL を実行する。
3. Authentication -> Providers -> Email で `Confirm email` を OFF にする。
4. Project Settings -> API から以下を取得する。
   - URL -> `TEST_SUPABASE_URL`
   - anon public key -> `TEST_SUPABASE_ANON_KEY`
   - service_role key -> `TEST_SUPABASE_SERVICE_ROLE_KEY`
5. `backend/.env.test.example` を `backend/.env.test` にコピーして値を入れる。
6. CI では GitHub Actions secrets に同じ 3 つを登録する。

`service_role` key は結合テスト fixture が使い捨てユーザーを作成 / 削除するためにだけ使います。Backend runtime の `.env` には入れないでください。

## 結合テストの実行

```bash
cd backend
source venv/bin/activate
pip install -r requirements-dev.txt
pytest -m integration
```

`TEST_SUPABASE_*` が未設定の場合、integration marker の付いたテストは自動 skip されます。

## ローカル Supabase CLI を使う場合

クラウドのテストプロジェクトではなくローカルで Supabase stack を起動したい場合は、Supabase CLI を使えます。

```bash
brew install supabase/tap/supabase
cd backend
supabase init
supabase start
```

`supabase start` の出力に表示される API URL、anon key、service_role key を `backend/.env.test` に設定すると、`pytest -m integration` をローカル Supabase に向けられます。
