function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    val !== null &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    Object.getPrototypeOf(val) === Object.prototype
  )
}

export function deepMerge<T extends Record<string, unknown>>(
  a: T,
  b: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = {}

  for (const key in a) {
    const aVal = a[key]
    result[key] = isPlainObject(aVal) ? deepMerge(aVal, {}) : aVal
  }

  for (const key in b) {
    const bVal = b[key]
    const aVal = result[key]
    if (isPlainObject(bVal) && isPlainObject(aVal)) {
      result[key] = deepMerge(aVal, bVal)
    } else if (bVal !== undefined) {
      result[key] = bVal
    }
  }

  return result as T
}

function cloneDeep(val: unknown): unknown {
  if (isPlainObject(val)) {
    return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, cloneDeep(v)]))
  }
  return val
}

export function setDeep(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (!path) throw new Error("Path cannot be empty")

  const keys = path.split(".")
  const result = cloneDeep(obj) as Record<string, unknown>
  let current = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!key) throw new Error("Path cannot contain empty segments")
    if (!isPlainObject(current[key])) current[key] = {}
    current = current[key] as Record<string, unknown>
  }

  const lastKey = keys[keys.length - 1]
  if (!lastKey) throw new Error("Path cannot contain empty segments")
  current[lastKey] = value
  return result
}