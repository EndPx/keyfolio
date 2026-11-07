// Minimal JSON value passthrough for typed query rows.

export type ParsedValue =
  | string
  | number
  | boolean
  | null
  | ParsedValue[]
  | { [key: string]: ParsedValue };
