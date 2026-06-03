export type FormPayload = Record<string, string | number | null>

type BuildFormPayloadOptions = {
  nullableFields?: readonly string[]
  numberFields?: readonly string[]
}

export function buildFormPayload(
  values: Record<string, string>,
  { nullableFields = [], numberFields = [] }: BuildFormPayloadOptions = {},
): FormPayload {
  const nullable = new Set(nullableFields)
  const numbers = new Set(numberFields)
  const payload: FormPayload = {}

  for (const [key, value] of Object.entries(values)) {
    if (value === '') {
      if (nullable.has(key)) payload[key] = null
      continue
    }
    payload[key] = numbers.has(key) ? Number.parseFloat(value) : value
  }

  return payload
}
