/**
 * Отключает подсказки автозаполнения браузера и часто используемые хуки менеджеров паролей
 * на произвольных текстовых полях (адреса, проекты, заметки и т.д.).
 * Для полей пароля API используйте {@link passwordCredentialInputProps}.
 */
export const noBrowserSuggestProps = Object.freeze({
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
})

/** Поля пароля/секрета: не отключаем менеджеры паролей, только автоподстановку формы. */
export const passwordCredentialInputProps = Object.freeze({
  autoComplete: 'new-password',
})
