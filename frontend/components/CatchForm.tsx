import { FormInput, FormSelect, FormTextarea } from '@/components/Form'
import type { CatchFormState } from '@/lib/catchFormConfig'
import type { Lure } from '@/lib/types'

type Props = {
  form: CatchFormState
  lures: Lure[]
  submitting: boolean
  submitLabel: string
  error: string | null
  showPlaceholders: boolean
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  onLureSelect: React.ChangeEventHandler<HTMLSelectElement>
  onSubmit: React.FormEventHandler<HTMLFormElement>
}

export function CatchForm({
  form,
  lures,
  submitting,
  submitLabel,
  error,
  showPlaceholders,
  onChange,
  onLureSelect,
  onSubmit,
}: Props) {
  const ph = (text: string) => (showPlaceholders ? text : undefined)

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <FormInput
        label="魚種"
        name="fish_species"
        type="text"
        value={form.fish_species}
        onChange={onChange}
        placeholder={ph('アマゴ、ヤマメ、イワナ...')}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="サイズ (cm)"
          name="length_cm"
          type="number"
          value={form.length_cm}
          onChange={onChange}
          placeholder={ph('25.5')}
          step="0.1"
        />
        <FormInput
          label="重さ (g)"
          name="weight_g"
          type="number"
          value={form.weight_g}
          onChange={onChange}
          placeholder={ph('200')}
          step="0.1"
        />
      </div>

      <FormSelect
        label="ルアー (登録済から選択)"
        name="lure_id"
        value={form.lure_id}
        onChange={onLureSelect}
      >
        <option value="">選択しない (自由入力)</option>
        {lures.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.color ? ` / ${l.color}` : ''}
          </option>
        ))}
      </FormSelect>

      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="ルアー名"
          name="lure_name"
          type="text"
          value={form.lure_name}
          onChange={onChange}
          placeholder={ph('Dコンタクト63')}
        />
        <FormInput
          label="カラー"
          name="lure_color"
          type="text"
          value={form.lure_color}
          onChange={onChange}
          placeholder={ph('チャート')}
        />
      </div>

      <FormSelect
        label="リリース / キープ"
        name="is_released"
        value={form.is_released}
        onChange={onChange}
      >
        <option value="true">リリース</option>
        <option value="false">キープ</option>
      </FormSelect>

      <FormTextarea
        label="メモ"
        name="notes"
        value={form.notes}
        onChange={onChange}
        rows={3}
        placeholder={ph('ヒットした場所や状況など...')}
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
