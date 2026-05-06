export type Spot = {
  id: string
  user_id: string
  name: string
  river_name: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
}

export type Lure = {
  id: string
  user_id: string
  name: string
  type: string | null
  color: string | null
  length_mm: number | null
  weight_g: number | null
  notes: string | null
  created_at: string
}

export type WaterLevel = '低水' | '平水' | '増水' | '大増水'
export type WaterClarity = 'クリア' | 'ステイン' | '笹濁り' | '濁り'
export type Weather = '晴れ' | '曇り' | '雨' | '雪'
export type LureType = 'ミノー' | 'スプーン' | 'スピナー' | 'クランク' | 'その他'

export type Session = {
  id: string
  user_id: string
  spot_id: string | null
  date: string
  start_time: string | null
  end_time: string | null
  water_level: WaterLevel | null
  water_clarity: WaterClarity | null
  weather: Weather | null
  notes: string | null
  created_at: string
}

export type SessionWithSpot = Session & {
  spots: { name: string; river_name: string | null } | null
}

export type Catch = {
  id: string
  session_id: string
  fish_species: string
  length_cm: number | null
  weight_g: number | null
  lure_id: string | null
  lure_name: string | null
  lure_color: string | null
  caught_at: string | null
  is_released: boolean
  photo_url: string | null
  notes: string | null
  created_at: string
}

export type SessionDetail = Session & {
  spots: { name: string; river_name: string | null } | null
  catches: Catch[]
}

export type MonthlyStats = Record<string, { session_count: number; catch_count: number }>
export type LureStats = Record<string, { count: number; avg_length: number }>
