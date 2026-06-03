export type SessionFormState = {
  spot_id: string
  date: string
  start_time: string
  end_time: string
  water_level: string
  water_clarity: string
  weather: string
  notes: string
}

export const EMPTY_SESSION_FORM: SessionFormState = {
  spot_id: '',
  date: '',
  start_time: '',
  end_time: '',
  water_level: '',
  water_clarity: '',
  weather: '',
  notes: '',
}

export const SESSION_NULLABLE_FIELDS = [
  'spot_id',
  'start_time',
  'end_time',
  'water_level',
  'water_clarity',
  'weather',
  'notes',
] as const
