export type CatchFormState = {
  fish_species: string
  length_cm: string
  weight_g: string
  lure_id: string
  lure_name: string
  lure_color: string
  is_released: 'true' | 'false'
  notes: string
}

export const EMPTY_CATCH_FORM: CatchFormState = {
  fish_species: '',
  length_cm: '',
  weight_g: '',
  lure_id: '',
  lure_name: '',
  lure_color: '',
  is_released: 'true',
  notes: '',
}

export const CATCH_NUMBER_FIELDS = ['length_cm', 'weight_g'] as const
export const CATCH_NULLABLE_FIELDS = [
  'length_cm',
  'weight_g',
  'lure_id',
  'lure_name',
  'lure_color',
  'notes',
] as const
