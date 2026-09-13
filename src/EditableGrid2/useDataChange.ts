import React from "react"
import { Atom, createAtom, shallow, useSelector } from "@tanstack/react-store"

/**
 * 行の値が変わったことを、表示中のセル・行・フッターへ伝える仕組み。
 *
 * 値が変わるたびにグリッド全体を再描画すると、表示中のセルの数だけ React 要素の生成と比較が走り重い。
 * そのため値の変化ではグリッド全体を再描画せず、各セルがこの通知を購読し、
 * 自分の描画に必要な値（getValueForRerender の戻り値など）が変わったときだけ描画し直す。
 *
 * 中身は通知の回数を持つ TanStack Store の atom。
 */
export type DataChangeNotifier = Atom<number>

/**
 * DataChangeNotifier を作り、以下のタイミングで通知する。
 * - 引数の subscribe（EditableGrid2Props.subscribe）による外部ストアの変更通知
 * - triggers のいずれかが変わったとき（React の state で値を持っている場合の更新や、判定関数の差し替えなど）
 */
export function useDataChangeNotifier(
  subscribe: ((onChange: () => void) => () => void) | undefined,
  triggers: React.DependencyList,
): DataChangeNotifier {

  const [notifier] = React.useState(() => createAtom(0))

  // 外部ストアの変更通知
  React.useEffect(() => {
    return subscribe?.(() => notifier.set(v => v + 1))
  }, [subscribe, notifier])

  // グリッドの props が変わったとき。
  // グリッド本体が再描画されても memo 化されたセルは描画し直されないため、ここで各セルに再確認させる。
  // 描画前（layout effect）に行うことで、古い表示が一瞬見えることを防ぐ。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => { notifier.set(v => v + 1) }, triggers)

  return notifier
}

/**
 * 通知のたびに select を評価し、前回の値と等しくない場合だけ呼び出し元のコンポーネントを再描画させる。
 * 比較は浅い比較で、配列は要素ごとに Object.is で比較する（getValueForRerender は毎回新しい配列を返すため）。
 */
export function useDataChangeSelector<T>(
  notifier: DataChangeNotifier,
  select: () => T,
): T {
  return useSelector(notifier, select, { compare: shallow })
}
