import { FormInput, FormSelect, FormTextarea } from '@/components/Form'
import type { SessionFormState } from '@/lib/sessionFormConfig'
import type { Spot } from '@/lib/types'

type Mode = 'create' | 'edit'

type Props = {
  mode: Mode
  form: SessionFormState
  spots: Spot[]
  submitting: boolean
  submitLabel: string
  error: string | null
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  onSubmit: React.FormEventHandler<HTMLFormElement>
  onNavigateToSpots?: () => void
}

const SPOT_LABEL: Record<Mode, string> = {
  create: '選択してください',
  edit: '未設定',
}

const SHORT_LABEL: Record<Mode, string> = {
  create: '選択',
  edit: '未設定',
}

export function SessionForm({
  mode,
  form,
  spots,
  submitting,
  submitLabel,
  error,
  onChange,
  onSubmit,
  onNavigateToSpots,
}: Props) {
  const spotLabel = SPOT_LABEL[mode]
  const shortLabel = SHORT_LABEL[mode]

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <FormInput label="日付" name="date" type="date" value={form.date} onChange={onChange} required />

      <div>
        <FormSelect label="ポイント" name="spot_id" value={form.spot_id} onChange={onChange}>
          <option value="">{spotLabel}</option>
          {spots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.river_name ? `${s.river_name} / ${s.name}` : s.name}
            </option>
          ))}
        </FormSelect>
        {mode === 'create' && spots.length === 0 && onNavigateToSpots && (
          <p className="text-xs text-gray-400 mt-1">
            ポイントは{' '}
            <button type="button" onClick={onNavigateToSpots} className="underline">
              ポイント管理
            </button>{' '}
            から追加できます
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormInput label="開始時間" name="start_time" type="time" value={form.start_time} onChange={onChange} />
        <FormInput label="終了時間" name="end_time" type="time" value={form.end_time} onChange={onChange} />
      </div>

      <FormSelect label="天気" name="weather" value={form.weather} onChange={onChange}>
        <option value="">{spotLabel}</option>
        <option>晴れ</option>
        <option>曇り</option>
        <option>雨</option>
        <option>雪</option>
      </FormSelect>

      <div className="grid grid-cols-2 gap-4">
        <FormSelect label="水量" name="water_level" value={form.water_level} onChange={onChange}>
          <option value="">{shortLabel}</option>
          <option>低水</option>
          <option>平水</option>
          <option>増水</option>
          <option>大増水</option>
        </FormSelect>
        <FormSelect label="水色" name="water_clarity" value={form.water_clarity} onChange={onChange}>
          <option value="">{shortLabel}</option>
          <option>クリア</option>
          <option>ステイン</option>
          <option>笹濁り</option>
          <option>濁り</option>
        </FormSelect>
      </div>

      <FormTextarea
        label="メモ"
        name="notes"
        value={form.notes}
        onChange={onChange}
        rows={3}
        placeholder={mode === 'create' ? '釣行のメモを入力...' : undefined}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
      >
        {submitting ? '保存中...' : submitLabel}
      </button>
    </form>
  )
}
