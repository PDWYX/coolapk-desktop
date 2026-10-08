/**
 * iOS 13（Safari 13 / WKWebView）降级支持。
 *
 * `crypto.randomUUID()` 需要 iOS 15.4+ 且要求安全上下文，`crypto.getRandomValues()`
 * 需要 iOS 11+。直接用 `crypto.randomUUID()` 在 iOS 13 上是 `TypeError`，
 * 所以这里统一做能力探测与兜底，全仓不要直接调用 `crypto.randomUUID()`。
 */
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

/** 等价于 `crypto.randomUUID()`，在任何 iOS 版本上都不会抛异常。 */
export function createRandomId(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) return native;

  // 按 RFC 4122 v4 拼装，形状与 crypto.randomUUID() 一致。
  const hex = randomHex(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

/** 生成带前缀的随机标识，用于形如 `article-xxxx` 的块 ID。 */
export function createPrefixedId(prefix: string): string {
  return `${prefix}-${createRandomId()}`;
}
