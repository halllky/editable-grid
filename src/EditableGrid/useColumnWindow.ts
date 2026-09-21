import React from "react"
import * as TanStackVirtual from "@tanstack/react-virtual"
import { GridHeader, GridTable } from "./types-internal"

/**
 * 列の仮想化の結果。1行の中で非固定列のどの要素を描画するかを決める。
 *
 * 固定列は sticky を成立させるため常に描画し、ここでは扱わない。
 * 非固定列は画面の表示範囲 + overscan の分だけ描画し、描画を省略した列の幅は、
 * 固定列と非固定列の間に置くスペーサー1個で埋める
 * （行は display: flex で左から詰めて並ぶため、左側の余白だけあれば位置が合う。
 * 右側の余白はテーブルの minWidth で確保されている）。
 */
export type ColumnWindow = {
  /** 描画する非固定列の範囲を表す文字列。範囲が変わったことの検知に使う */
  key: string
  /** 非固定の可視リーフ列と同じ並びの配列から、描画する要素を取り出す。ボディ行・フッター行用 */
  sliceLeaves: <T>(items: T[]) => ColumnWindowSlice<T>
  /** 非固定列のヘッダ行の要素から、描画する要素を取り出す。グループ見出しのように複数列にまたがる要素も扱える */
  sliceHeaders: (headers: GridHeader[]) => ColumnWindowSlice<GridHeader>
}

/** 1行の中で描画する非固定列の要素 */
export type ColumnWindowSlice<T> = {
  /** 固定列と描画する要素の間に置くスペーサーの幅。0 の場合はスペーサー不要 */
  spacerWidth: number
  /** 描画する要素 */
  items: T[]
}

/**
 * 列の仮想化を行うフック。
 * 行の仮想化と同じスクロールコンテナを横方向に監視する。
 */
export function useColumnWindow(
  table: GridTable,
  /** スクロールコンテナ */
  tableContainerRef: React.RefObject<HTMLDivElement | null>,
  /** 表示範囲外の列をどこまで予め描画しておくか */
  overscan: number,
  /** 列幅が変わったことを検知するためだけに使う */
  columnSizing: unknown,
): ColumnWindow {

  const centerColumns = table.getCenterVisibleLeafColumns()

  const columnVirtualizer = TanStackVirtual.useVirtualizer({
    horizontal: true,
    count: centerColumns.length,
    getScrollElement: () => tableContainerRef.current,
    // 列幅は TanStack Table が保持しているため、DOM を実測せずそのまま使う
    estimateSize: index => centerColumns[index].getSize(),
    // 非固定列は固定列の右から始まる
    paddingStart: table.getStartTotalSize(),
    overscan,
    // 列が追加・削除・移動・表示切替されたときに正しく再計算されるようにする
    getItemKey: React.useCallback((index: number) => {
      return centerColumns[index].id
    }, [centerColumns]),
  })

  // TanStack Virtual は計算済みの列位置をキャッシュしており、estimateSize の戻り値が変わっても再計算しない。
  // そのため列幅が変わったときは明示的に再計算させる。
  React.useLayoutEffect(() => {
    columnVirtualizer.measure()
  }, [columnVirtualizer, columnSizing])

  // 描画する非固定列の範囲（両端を含む）と、それが占める x 座標の範囲（非固定列の先頭からの位置）
  const virtualItems = columnVirtualizer.getVirtualItems()
  const start = virtualItems[0]?.index ?? 0
  const end = virtualItems[virtualItems.length - 1]?.index ?? -1
  const hasItems = start <= end
  const renderedLeft = hasItems ? centerColumns[start].getStart('center') : 0
  const renderedRight = hasItems ? centerColumns[end].getStart('center') + centerColumns[end].getSize() : 0

  return {
    key: `${start}:${end}`,

    sliceLeaves: items => ({
      spacerWidth: renderedLeft,
      items: hasItems ? items.slice(start, end + 1) : [],
    }),

    sliceHeaders: headers => {
      // 非固定列のヘッダの getStart は非固定列の先頭からの位置。
      // 描画する列に一部でも掛かる見出しは、見出し全体を描画する
      const items = headers.filter(header => {
        const left = header.getStart()
        return left < renderedRight && left + header.getSize() > renderedLeft
      })
      return {
        spacerWidth: items[0]?.getStart() ?? 0,
        items,
      }
    },
  }
}
