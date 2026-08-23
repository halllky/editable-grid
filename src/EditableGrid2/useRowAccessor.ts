import React from "react"

/**
 * 行インデックスからその行の最新の値を取得する関数
 */
export type RowAccessor<TRow> = (rowIndex: number) => TRow

/**
 * 行インデックスからその行の最新の値を取得する関数を返します。
 */
export function useRowAccessor<TRow>(
  getLatestRowObject: (index: number) => TRow
) {

  const getLatestRowObjectRef = React.useRef(getLatestRowObject)
  getLatestRowObjectRef.current = getLatestRowObject

  return React.useCallback<RowAccessor<TRow>>(rowIndex => {
    return getLatestRowObjectRef.current(rowIndex)
  }, [])
}

/**
 * 配列の内容（各要素の値と並び順）が前回と変わっていない場合は、
 * 前回の配列インスタンスをそのまま返す。
 * 呼び出し側がインラインで新しい配列を渡しても、余計な再描画やテーブルの再構築を防ぐために使用する。
 */
export function useStableArray<T>(array: T[]): T[] {
  const ref = React.useRef(array)
  if (ref.current !== array
    && (ref.current.length !== array.length
      || array.some((x, i) => !Object.is(x, ref.current[i])))) {
    ref.current = array
  }
  return ref.current
}
