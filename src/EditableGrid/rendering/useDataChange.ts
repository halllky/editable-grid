import React from "react"

/**
 * 行の値が変わったことを、表示中のセル・行・フッターへ伝える仕組み。
 *
 * 値が変わるたびにグリッド全体を再描画すると、表示中のセルの数だけ React 要素の生成と比較が走り重い。
 * そのため値の変化ではグリッド全体を再描画せず、各セルがこの通知を useSyncExternalStore で購読し、
 * 自分の描画に必要な値（getValuesForRender の戻り値など）が変わったときだけ描画し直す。
 */
export type DataChangeNotifier = {
  subscribe: (listener: () => void) => () => void
  /** 通知の回数。値が変わるたびに必ず描画し直すもの（フッター）の判定に使う */
  getVersion: () => number
}

/**
 * DataChangeNotifier を作り、以下のタイミングで通知する。
 * - 引数の subscribe（EditableGridProps.subscribe）による外部ストアの変更通知
 * - triggers のいずれかが変わったとき（React の state で値を持っている場合の更新や、判定関数の差し替えなど）
 */
export function useDataChangeNotifier(
  subscribe: ((onChange: () => void) => () => void) | undefined,
  triggers: React.DependencyList,
): DataChangeNotifier {

  const [notifier] = React.useState(() => {
    const listeners = new Set<() => void>()
    let version = 0
    return {
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
      getVersion: () => version,
      notify: () => {
        version = version >= Number.MAX_SAFE_INTEGER ? 0 : version + 1
        for (const listener of listeners) listener()
      },
    }
  })

  // 外部ストアの変更通知
  React.useEffect(() => {
    return subscribe?.(notifier.notify)
  }, [subscribe, notifier])

  // グリッドの props が変わったとき。
  // グリッド本体が再描画されても memo 化されたセルは描画し直されないため、ここで各セルに再確認させる。
  // 描画前（layout effect）に行うことで、古い表示が一瞬見えることを防ぐ。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => notifier.notify(), triggers)

  return notifier
}

/**
 * 通知のたびに select を評価し、前回の値と等しくない場合だけ呼び出し元のコンポーネントを再描画させる。
 * （use-sync-external-store/with-selector と同じ考え方）
 */
export function useDataChangeSelector<T>(
  notifier: DataChangeNotifier,
  select: () => T,
): T {
  const cacheRef = React.useRef<{ value: T } | null>(null)

  // 前回と等しい場合は前回の値を返す。
  // useSyncExternalStore は getSnapshot の戻り値を Object.is で比較するため、そのままでは毎回再描画されてしまう。
  const getSnapshot = () => {
    const next = select()
    const cached = cacheRef.current
    if (cached && isShallowEqual(cached.value, next)) return cached.value
    cacheRef.current = { value: next }
    return next
  }

  return React.useSyncExternalStore(notifier.subscribe, getSnapshot)
}

/**
 * 配列は要素ごとに Object.is で比較し（getValuesForRender は毎回新しい配列を返すため）、それ以外は Object.is で比較する。
 */
function isShallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}
