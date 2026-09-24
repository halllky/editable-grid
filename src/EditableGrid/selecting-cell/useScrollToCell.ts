import React from "react"
import { CellPosition } from "./useSelection"
import { GridColumn } from "../types-internal"
import { GetPixelFunction } from "../rendering"

/**
 * セルが見えるようにスクロールする関数
 */
export type ScrollToCellFunction = (cell: CellPosition | null) => void

/**
 * 指定のセルが見えるようにスクロールする関数を返す
 */
export function useScrollToCell(
  getPixel: GetPixelFunction,
  visibleLeafColumns: GridColumn[],
  /** 固定列の合計幅 */
  fixedWidth: number,
  tableContainerRef: React.RefObject<HTMLDivElement | null>,
  totalHeaderHeight: number,
  totalFooterHeight: number,
): ScrollToCellFunction {

  return React.useCallback((cell: CellPosition | null) => {
    if (!cell) return
    const container = tableContainerRef.current
    if (!container) return

    // 行スクロール
    const rowTop = getPixel({ position: 'top', rowIndex: cell.rowIndex })
    const rowBottom = getPixel({ position: 'bottom', rowIndex: cell.rowIndex })

    const containerTop = container.scrollTop
    const containerHeight = container.clientHeight

    // 動的にスクロールバーの高さを考慮
    const hasHorizontalScrollbar = container.scrollWidth > container.clientWidth
    const scrollBarHeight = hasHorizontalScrollbar ? (container.offsetHeight - container.clientHeight) : 0

    // 少し余裕を持たせる
    const SCROLL_PADDING = 4

    if (rowTop < containerTop + totalHeaderHeight + SCROLL_PADDING) {
      // 上に見切れている -> 上端合わせ (ヘッダー分考慮)
      container.scrollTop = rowTop - totalHeaderHeight - SCROLL_PADDING

    } else if (rowBottom > containerTop + containerHeight - scrollBarHeight - totalFooterHeight - SCROLL_PADDING) {
      // 下に見切れている (フッター分考慮)
      if (rowBottom - rowTop > containerHeight - totalHeaderHeight - totalFooterHeight - scrollBarHeight) {
        // セル高さが可視領域より高い -> 上端合わせ
        container.scrollTop = rowTop - totalHeaderHeight - SCROLL_PADDING
      } else {
        // 下端合わせ
        container.scrollTop = rowBottom - containerHeight + scrollBarHeight + totalFooterHeight + SCROLL_PADDING
      }
    }

    // 列スクロール（固定列は常に見えているので対象外）
    const column = visibleLeafColumns[cell.colIndex]
    if (column && !column.getIsPinned()) {

      const columnLeft = column.getStart()
      const columnWidth = column.getSize()
      const columnRight = columnLeft + columnWidth

      const containerLeft = container.scrollLeft
      const containerWidth = container.clientWidth

      // 可視領域の右端（絶対座標）
      const visibleRightBoundary = containerLeft + containerWidth

      if (columnLeft < containerLeft + fixedWidth + SCROLL_PADDING) {
        // 左に見切れている -> 左端合わせ
        container.scrollLeft = columnLeft - fixedWidth - SCROLL_PADDING
      } else if (columnRight > visibleRightBoundary - SCROLL_PADDING) {
        // 右に見切れている
        const visibleWidth = containerWidth - fixedWidth
        if (columnWidth > visibleWidth) {
          // セル幅が可視領域より広い -> 左端合わせ
          container.scrollLeft = columnLeft - fixedWidth - SCROLL_PADDING
        } else {
          // 右端合わせ
          container.scrollLeft = columnRight - containerWidth + SCROLL_PADDING
        }
      }
    }
  }, [getPixel, visibleLeafColumns, fixedWidth, tableContainerRef, totalHeaderHeight, totalFooterHeight])
}
