import React from "react"
import * as TanStack from "@tanstack/react-table"
import * as TanStackVirtual from "@tanstack/react-virtual"

/**
 * 列の仮想化の結果。1行の中でどの要素を描画するかを決める。
 *
 * 固定列は sticky を成立させるため常に描画し、スクロール列は画面の表示範囲 + overscan の分だけ描画する。
 * 描画を省略した列の幅は、固定列とスクロール列の間に置くスペーサー1個で埋める
 * （行は display: flex で左から詰めて並ぶため、左側の余白だけあれば位置が合う。
 * 右側の余白はテーブルの minWidth で確保されている）。
 */
export type ColumnWindow = {
  /** 可視リーフ列と同じ並び（colIndex 順）の配列から、描画する要素を取り出す。ボディ行・フッター行用 */
  sliceLeaves: <T>(items: T[]) => ColumnWindowSlice<T>
  /** ヘッダ行の要素から、描画する要素を取り出す。グループ見出しのように複数列にまたがる要素も扱える */
  sliceHeaders: <T>(headers: TanStack.Header<T, unknown>[]) => ColumnWindowSlice<TanStack.Header<T, unknown>>
}

/** 1行の中で描画する要素 */
export type ColumnWindowSlice<T> = {
  /** 固定列の要素。常に描画される */
  fixed: T[]
  /** 固定列とスクロール列の間に置くスペーサーの幅。0 の場合はスペーサー不要 */
  spacerWidth: number
  /** スクロール列のうち描画する要素 */
  scrollable: T[]
}

/**
 * 列の仮想化を行うフック。
 * 行の仮想化と同じスクロールコンテナを横方向に監視する。
 */
export function useColumnWindow(
  /** 可視の非グループ列 */
  visibleLeafColumns: TanStack.Column<any, unknown>[],
  /** もっとも右にある固定列のインデックス。固定列が無い場合は null */
  lastFixedIndex: number | null,
  /** スクロールコンテナ */
  tableContainerRef: React.RefObject<HTMLDivElement | null>,
  /** 表示範囲外の列をどこまで予め描画しておくか */
  overscan: number,
  /** 列幅が変わったことを検知するためだけに使う */
  columnSizing: unknown,
): ColumnWindow {

  const columnVirtualizer = TanStackVirtual.useVirtualizer({
    horizontal: true,
    count: visibleLeafColumns.length,
    getScrollElement: () => tableContainerRef.current,
    // 列幅は TanStack Table が保持しているため、DOM を実測せずそのまま使う
    estimateSize: index => visibleLeafColumns[index].getSize(),
    overscan,
    // 列が追加・削除・移動・表示切替されたときに正しく再計算されるようにする
    getItemKey: React.useCallback((index: number) => {
      return visibleLeafColumns[index].id
    }, [visibleLeafColumns]),
  })

  // TanStack Virtual は計算済みの列位置をキャッシュしており、estimateSize の戻り値が変わっても再計算しない。
  // そのため列幅が変わったときは明示的に再計算させる。
  React.useLayoutEffect(() => {
    columnVirtualizer.measure()
  }, [columnVirtualizer, columnSizing])

  // 固定列（チェックボックス列を含む）は先頭から fixedCount 列
  const fixedCount = lastFixedIndex === null ? 0 : lastFixedIndex + 1
  const lastFixedColumn = lastFixedIndex === null ? undefined : visibleLeafColumns[lastFixedIndex]
  const fixedRight = lastFixedColumn ? lastFixedColumn.getStart() + lastFixedColumn.getSize() : 0

  // 描画するスクロール列の colIndex の範囲（両端を含む）。
  // 固定列の裏に隠れている列も表示範囲とみなされるが、固定列自体は別枠で描画するので除外する。
  const virtualItems = columnVirtualizer.getVirtualItems()
  const start = Math.max(fixedCount, virtualItems[0]?.index ?? 0)
  const end = virtualItems[virtualItems.length - 1]?.index ?? -1
  const hasScrollable = start <= end

  // 描画するスクロール列が占める x 座標の範囲
  const renderedLeft = hasScrollable ? visibleLeafColumns[start].getStart() : 0
  const renderedRight = hasScrollable ? visibleLeafColumns[end].getStart() + visibleLeafColumns[end].getSize() : 0

  return {
    sliceLeaves: items => ({
      fixed: items.slice(0, fixedCount),
      spacerWidth: hasScrollable ? renderedLeft - fixedRight : 0,
      scrollable: hasScrollable ? items.slice(start, end + 1) : [],
    }),

    sliceHeaders: headers => {
      const fixed: typeof headers = []
      const scrollable: typeof headers = []
      let fixedEnd = 0
      for (const header of headers) {
        const left = header.getStart()
        const right = left + header.getSize()
        if (right <= fixedRight) {
          // 固定列の範囲に収まる見出しは常に描画する
          fixed.push(header)
          fixedEnd = right
        } else if (left < renderedRight && right > renderedLeft) {
          // 描画するスクロール列に一部でも掛かる見出しは、見出し全体を描画する
          scrollable.push(header)
        }
      }
      return {
        fixed,
        // 固定列をまたぐグループ見出しは fixedEnd より左から始まるため、スペーサーは不要
        spacerWidth: scrollable.length > 0 ? Math.max(0, scrollable[0].getStart() - fixedEnd) : 0,
        scrollable,
      }
    },
  }
}
