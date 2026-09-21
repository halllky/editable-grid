import React from "react"
import * as TanStack from "@tanstack/react-table"
import { GridCell, GridColumn, GridTable } from "./types-internal"
import { EditableGridProps, EditableGridSelectRowOptions } from "./types-public"
import { ScrollToCellFunction } from "./useScrollToCell"

/**
 * ボディセルの位置を表す構造体。
 * 不可視なセルを除いた、見えている範囲でのインデックス。
 * 列インデックスについてはチェックボックス列がある場合それを0とする。
 */
export interface CellPosition {
  rowIndex: number
  colIndex: number
}

/**
 * セル選択範囲を表す構造体。
 * 不可視なセルを除いた、見えている範囲でのインデックス。
 * 列インデックスについてはチェックボックス列がある場合それを0とする。
 */
export interface CellSelectionRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

/** 矢印キーと、選択を動かす方向の対応 */
const ARROW_KEY_DIRECTIONS: Partial<Record<string, TanStack.CellSelectionDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * グリッドの範囲選択機能を提供するフック。
 *
 * 選択状態は TanStack Table の cellSelectionFeature が行・列のIDで持つ
 * （行の挿入・削除があっても同じセルを指し続ける）。
 * このフックはキーボード・マウス・フォーカスの操作を cellSelectionFeature の API に変換し、
 * 描画用に行・列のインデックスに直した選択範囲を返す。
 * 
 * 選択範囲とアクティブセルは、レンダリング時の値ではなく「呼び出した時点の値を返す関数」として提供する。
 * 値として返すとグリッド本体がセル選択の state を購読することになり、
 * 選択が動くたびに表示中のセルすべての React 要素の生成と比較が走るため。
 * 選択状態に依存したレンダリングが必要なコンポーネントは table.Subscribe を使う。
 */
export function useSelection<TRow>(
  table: GridTable,
  props: EditableGridProps<TRow>,
  visibleLeafColumns: GridColumn[],
  scrollToCell: ScrollToCellFunction,
) {

  //#region 状態

  /** 選択範囲。無い場合は null */
  const getSelectedRange = (): CellSelectionRange | null => {
    const bounds = table.getCellSelectionBounds()[0]
    return bounds ? {
      startRow: bounds.minRowIndex,
      startCol: bounds.minColumnIndex,
      endRow: bounds.maxRowIndex,
      endCol: bounds.maxColumnIndex,
    } : null
  }

  /**
   * アクティブセル。
   * 範囲選択の起点で、Shiftキーを押しながらの選択範囲の拡張では動かない。
   * セルエディタはこのセルの位置に置かれ、キー入力による編集の対象になる。
   */
  const getActiveCell = (): CellPosition | null => {
    const cell = table.getFocusedCell()
    return cell ? toPosition(cell) : null
  }

  // フォーカスが外れたときに選択をクリアした場合の、クリア前の選択
  const lastSelectionRef = React.useRef<TanStack.CellSelectionState | null>(null)

  //#endregion 状態

  // -------------------------------

  //#region 変換

  /** インデックスで指定したセルをグリッドの範囲内に収め、行・列のIDにする。グリッドが空の場合は null */
  const toCellIds = (cell: CellPosition) => {
    const rows = table.getRowModel().rows
    const minColIndex = visibleLeafColumns.findIndex(c => c.columnDef.enableCellSelection !== false)
    if (rows.length === 0 || minColIndex === -1) return null

    return {
      rowId: rows[clamp(cell.rowIndex, 0, rows.length - 1)].id,
      columnId: visibleLeafColumns[clamp(cell.colIndex, minColIndex, visibleLeafColumns.length - 1)].id,
    }
  }

  /** 行・列のIDで指定したセルの位置。セルが存在しない場合は null */
  const idsToPosition = (rowId: string, columnId: string): CellPosition | null => {
    const cell = table.getRowModel().rowsById[rowId]?.getAllCellsByColumnId()[columnId]
    return cell ? toPosition(cell) : null
  }

  /** インデックスで指定した範囲を選択する。範囲外のインデックスはグリッドの範囲内に収める */
  const selectRange = (anchor: CellPosition, focus: CellPosition) => {
    const a = toCellIds(anchor)
    const f = toCellIds(focus)
    if (!a || !f) {
      table.resetCellSelection(true)
      return
    }
    table.selectCellRange({
      anchorRowId: a.rowId,
      anchorColumnId: a.columnId,
      focusRowId: f.rowId,
      focusColumnId: f.columnId,
    })
  }

  /**
   * 選択範囲の動く側の角が見えるようにスクロールする。
   */
  const scrollToFocusedCell = () => {
    // セル選択の state をもとに移動先を決める。
    // state はキー操作の中で同期的に更新されるため、
    // レンダリングを待たずして移動先セルの位置が分かる。
    const active = getActiveRange(table.atoms.cellSelection.get())
    if (active) scrollToCell(idsToPosition(active.focusRowId, active.focusColumnId))
  }

  /** マウスイベントの対象のボディセル。フッター等、ボディセル以外の td は対象外 */
  const getCellFromMouseEvent = (e: React.MouseEvent): GridCell | undefined => {
    // 属性名は EditableGrid.tsx で設定しているものと一致させる必要がある
    const td = (e.target as HTMLElement).closest('td[data-eg2-row-index]')
    if (!td) return undefined

    const row = table.getRowModel().rows[Number(td.getAttribute('data-eg2-row-index'))]
    const column = visibleLeafColumns[Number(td.getAttribute('data-eg2-col-index'))]
    if (!row || !column) return undefined

    return row.getAllCellsByColumnId()[column.id]
  }

  //#endregion 変換

  // -------------------------------

  //#region イベント

  // 関数への参照を安定させて不要なレンダリングを抑制するためにメモ化する
  const handleKeyDown = React.useRef<React.KeyboardEventHandler>(() => { })
  const handleMouseDown = React.useRef<React.MouseEventHandler>(() => { })
  const handleMouseMove = React.useRef<React.MouseEventHandler>(() => { })
  const handleGridActiveChanged = React.useRef<(isGridActive: boolean) => void>(() => { })

  // 矢印キーによるセル移動
  handleKeyDown.current = e => {
    if (e.altKey) return // Altキーはセル種別特有のイベント（ドロップダウンのメニュー展開など）が多いのでここでは処理しない
    const direction = ARROW_KEY_DIRECTIONS[e.key]
    if (!direction) return

    e.preventDefault()

    // 選択していたセルが行の削除などで無くなった場合は先頭セルから始める
    const active = getActiveRange(table.atoms.cellSelection.get())
    const activeCell = getActiveCell()
    if (!active || !activeCell) {
      selectRange({ rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 0 })
      return
    }

    if (e.ctrlKey || e.metaKey) {
      // Ctrl キーが押されていれば端まで移動。範囲の外側の端はグリッドの範囲内に収められる
      const from = e.shiftKey
        ? idsToPosition(active.focusRowId, active.focusColumnId)
        : activeCell
      if (!from) return
      const to = { ...from }
      switch (direction) {
        case 'up': to.rowIndex = 0; break
        case 'down': to.rowIndex = Number.MAX_SAFE_INTEGER; break
        case 'left': to.colIndex = 0; break
        case 'right': to.colIndex = Number.MAX_SAFE_INTEGER; break
      }
      selectRange(e.shiftKey ? activeCell : to, to)

    } else if (e.shiftKey) {
      table.extendCellSelection(direction)
    } else {
      table.moveCellSelection(direction)
    }

    scrollToFocusedCell()
  }

  // マウスダウン。Shiftキーが押されていれば範囲選択拡張、押されていなければ新規選択開始。
  // ドラッグの終了（mouseup）は TanStack Table が document で検知する。
  handleMouseDown.current = e => {
    getCellFromMouseEvent(e)?.getSelectionStartHandler()(e)
  }

  // マウスムーブ。ドラッグ中であれば範囲選択拡張。
  handleMouseMove.current = e => {
    getCellFromMouseEvent(e)?.getSelectionExtendHandler()(e)
  }

  // グリッドのアクティブ状態が変化したとき。
  // * フォーカスがあたったときは、最後に選択していた範囲か、それがなければ先頭セルを選択
  //   （セルのクリックでフォーカスが当たった場合は、先に mousedown で選択されている）
  // * フォーカスが外れたときは選択解除（プロパティで指定されている場合のみ）
  handleGridActiveChanged.current = isGridActive => {
    if (isGridActive) {
      if (table.getFocusedCell()) return
      if (lastSelectionRef.current) table.setCellSelection(lastSelectionRef.current)
      if (!table.getFocusedCell()) selectRange({ rowIndex: 0, colIndex: 0 }, { rowIndex: 0, colIndex: 0 })

    } else if (props.clearSelectionOnBlur) {
      lastSelectionRef.current = table.atoms.cellSelection.get()
      table.resetCellSelection(true)
    }
  }

  const selectionEvents = React.useMemo(() => ({
    handleKeyDown: (e: React.KeyboardEvent) => handleKeyDown.current(e),
    handleMouseDown: (e: React.MouseEvent) => handleMouseDown.current(e),
    handleMouseMove: (e: React.MouseEvent) => handleMouseMove.current(e),
    handleGridActiveChanged: (isGridActive: boolean) => handleGridActiveChanged.current(isGridActive),
  }), [])

  //#endregion イベント

  // -------------------------------

  //#region API

  const selectRowRef = React.useRef(selectRange)
  selectRowRef.current = selectRange

  const scrollToFocusedCellRef = React.useRef(scrollToFocusedCell)
  scrollToFocusedCellRef.current = scrollToFocusedCell

  const selectRow = React.useCallback((startRow: number, endRow: number, options?: EditableGridSelectRowOptions) => {
    selectRowRef.current(
      { rowIndex: endRow, colIndex: Number.MAX_SAFE_INTEGER },
      { rowIndex: startRow, colIndex: 0 })

    // 選択した行が見えるようスクロールする（選択範囲の始点の側のセルに合わせる）
    if (!options?.preventScroll) scrollToFocusedCellRef.current()
  }, [])

  const setSelectionRange = React.useCallback((range: CellSelectionRange) => {
    selectRowRef.current(
      { rowIndex: range.startRow, colIndex: range.startCol },
      { rowIndex: range.endRow, colIndex: range.endCol })
  }, [])

  //#endregion API

  return {
    getSelectedRange,
    getActiveCell,
    selectionEvents,
    selectRow,
    setSelectionRange,
  }
}

/** セルの位置。列が非表示の場合は null */
function toPosition(cell: GridCell): CellPosition | null {
  const colIndex = cell.column.getIndex()
  return colIndex === -1 ? null : { rowIndex: cell.row.index, colIndex }
}

/** 操作中の範囲（最後に追加された範囲）。Shift キーやドラッグによる拡張の対象になる */
function getActiveRange(cellSelection: TanStack.CellSelectionState): TanStack.CellSelectionRange | undefined {
  return cellSelection[cellSelection.length - 1]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
