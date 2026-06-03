import { useId } from 'react'

const INPUT_CLASS =
  'w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1'

type Common = {
  label: string
  name: string
  required?: boolean
  className?: string
}

function joinClass(extra: string | undefined): string {
  return extra ? `${INPUT_CLASS} ${extra}` : INPUT_CLASS
}

export function FormInput({
  label,
  name,
  required,
  className,
  id: idProp,
  ...rest
}: Common &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'required' | 'className'>) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {required && ' *'}
      </label>
      <input
        id={id}
        name={name}
        required={required}
        className={joinClass(className)}
        {...rest}
      />
    </div>
  )
}

export function FormSelect({
  label,
  name,
  required,
  className,
  id: idProp,
  children,
  ...rest
}: Common &
  Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    'name' | 'required' | 'className' | 'children'
  > & { children: React.ReactNode }) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {required && ' *'}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        className={joinClass(className)}
        {...rest}
      >
        {children}
      </select>
    </div>
  )
}

export function FormTextarea({
  label,
  name,
  required,
  className,
  id: idProp,
  ...rest
}: Common &
  Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'name' | 'required' | 'className'
  >) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {required && ' *'}
      </label>
      <textarea
        id={id}
        name={name}
        required={required}
        className={joinClass(className)}
        {...rest}
      />
    </div>
  )
}
