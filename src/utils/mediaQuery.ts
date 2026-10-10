// iOS 13（Safari 13）的 MediaQueryList 只实现了已废弃的 addListener / removeListener，
// addEventListener / removeEventListener 要 Safari 14 才有。
// 直接写 `media.addEventListener('change', fn)`（哪怕前面带了 `media?.`）在 iOS 13 上会抛
// `TypeError: media.addEventListener is not a function`，而它一旦发生在 store 初始化阶段，
// 整个 main.ts 顶层就会中断，表现就是纯白屏且没有任何报错弹窗。
// 这里统一做一次能力探测，两种接口都兼容。
type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

/**
 * 给 MediaQueryList 注册 change 监听，返回取消监听的函数。
 * @param media matchMedia 的返回值，允许为 null / undefined
 * @param listener 监听回调
 */
export function addMediaQueryListener(
  media: MediaQueryList | null | undefined,
  listener: (event: MediaQueryListEvent) => void,
): () => void {
  if (!media) return () => {};

  const target = media as LegacyMediaQueryList;
  if (typeof target.addEventListener === 'function') {
    target.addEventListener('change', listener);
    return () => {
      if (typeof target.removeEventListener === 'function') target.removeEventListener('change', listener);
    };
  }
  if (typeof target.addListener === 'function') {
    target.addListener(listener);
    return () => {
      if (typeof target.removeListener === 'function') target.removeListener(listener);
    };
  }
  return () => {};
}
