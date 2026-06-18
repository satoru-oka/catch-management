# システム全体像（catch-management ↔ fishing-dashboard）

東京湾を軸にした釣果管理の 2 アプリ構成。**疎結合（パターンA）** で、データ基盤（Supabase）を共有する。詳細な内部設計は `docs/architecture.md` を参照。

- **catch-management** … スマホ入力アプリ（Next.js / PWA）＋ FastAPI ＋ Supabase。データの保存・認証(RLS)・集計を担う。現場グランス（軻い集計）もここ。
- **fishing-dashboard** … 分析・可視化（Vite / deck.gl / Plotly）。データは保存せず、取得して描くだけ。重い深掘り分析はデスクトップで。

```mermaid
flowchart TB
  subgraph CM["catch-management （入力・データ基盤）"]
    MUI["スマホ UI / PWA<br/>釣果入力 ＋ 現場グランス"]
    API["FastAPI<br/>stats.py / 集計"]
    DB[("Supabase / PostgreSQL<br/>spots・sessions・catches・lures<br/>RLS・stats views")]
    PV["public_catches ビュー<br/>匿名・公開オプトイン"]
    MUI -->|JWT で read/write| API
    API -->|PostgREST ＋ RLS| DB
    DB -.-> PV
  end

  subgraph FD["fishing-dashboard （分析・可視化）"]
    DASH["デスクトップ深掘りダッシュボード<br/>deck.gl / Plotly"]
  end

  PV ==>|匿名 fetch（公開ビュー）| DASH
  API -.->|JWT fetch（個人ビュー・将来）| DASH
```

## 関係の要点

- **データの所有は catch-management**。fishing-dashboard は読み手・描き手で、DB を持たない。
- **取得経路は 2 本**: 公開ビュー（匿名集計）と、個人ビュー（JWT 認証・将来）。
- **現状の fishing-dashboard は CSV 読み込み**で、API fetch への差し替えが移行ステップ。
- deck.gl/Plotly は重いのでモバイルに載せず、デスクトップに分離（疎結合の理由）。

## 関連ドキュメント

- catch-management: `docs/architecture.md` / `docs/database-setup.md` / `supabase/migrations/001_dual_domain_schema.sql`
- fishing-dashboard: `docs/field-glance-metrics.md`、統合の経緯 #40
