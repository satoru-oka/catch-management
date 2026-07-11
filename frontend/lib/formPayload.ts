export type FormPayload = Record<string, string | number | null>

type BuildFormPayloadOptions<F> = {
  nullableFields?: readonly (keyof F & string)[]
  numberFields?: readonly (keyof F & string)[]
}

export function buildFormPayload<F extends Record<string, string>>(
  values: F,
  { nullableFields = [], numberFields = [] }: BuildFormPayloadOptions<F> = {},
): FormPayload {
  const nullable = new Set<string>(nullableFields)
  const numbers = new Set<string>(numberFields)
  const payload: FormPayload = {}

  for (const [key, value] of Object.entries(values)) {
    if (value === '') {
      if (nullable.has(key)) payload[key] = null
      continue
    }
    if (numbers.has(key)) {
      const parsed = Number.parseFloat(value)
      if (Number.isNaN(parsed)) {
        if (nullable.has(key)) payload[key] = null
        continue
      }
      payload[key] = parsed
    } else {
      payload[key] = value
    }
  }

  return payload
}
