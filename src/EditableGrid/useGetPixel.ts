import React from "react"
import * as TanStackVirtual from "@tanstack/react-virtual"
import { GridColumn } from "./types-internal"

/**
 * rowIndexやcolIndexから、スクロールエリア内でのx, y座標のピクセルを導出する関数。
 * 列幅変更や行の仮想化を考慮している。
 */
export type GetPixelFunction = (args
  : { position: 'top', rowIndex: number, colIndex?: never }
  | { position: 'bottom', rowIndex: number, colIndex?: never }
  | { position: 'left', colIndex: number, rowIndex?: never }
  | { position: 'right', colIndex: number, rowIndex?: never }
) => number

/**
 * rowIndexやcolIndexから、スクロールエリア内でのx, y座標のピクセルを導出する関数。
 * 列幅変更や行の仮想化を考慮している。
 */
export function useGetPixel(
  /** 可視の非グループ列 */
  visibleLeafColumns: GridColumn[],
  /** スクロール表示範囲に含まれる行。行の位置が変わったことを検知するためだけに使う */
  virtualItems: TanStackVirtual.VirtualItem[],
  /** 行の仮想化を司るオブジェクト */
  rowVirtualizer: TanStackVirtual.Virtualizer<HTMLDivElement, Element>,
  /** ヘッダーの合計高さ */
  totalHeaderHeight: number,
  /** 再レンダリングのトリガーに使っているだけ */
  columnSizing: unknown,
): GetPixelFunction {

  return React.useCallback(args => {

    // 水平方向の位置
    if (args.position === 'left' || args.position === 'right') {
      const column = visibleLeafColumns[args.colIndex]
      if (!column) return 0

      return args.position === 'left'
        ? column.getStart()
        : column.getStart() + column.getSize()
    }

    // 垂直方向の位置。
    // TanStack Virtual が全行の位置を計算済み（描画範囲外の行は推定の高さ、描画した行は実測の高さ）なのでそれを使う
    const item = rowVirtualizer.measurementsCache[args.rowIndex]
    if (!item) return 0

    return (args.position === 'top' ? item.start : item.end) + totalHeaderHeight

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLeafColumns, rowVirtualizer, totalHeaderHeight, virtualItems, columnSizing])
}
