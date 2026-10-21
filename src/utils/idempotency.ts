/**
 * 幂等键生成。
 *
 * 契约依据 API.md §3：每次新操作生成至少 128 位随机熵的唯一键，长度 16–256；
 * 网络超时重试必须复用原键，换图或修改载荷必须生成新键。
 * crypto.randomUUID() 为 v4 UUID，122 位随机熵 + 版本位，满足要求。
 */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
