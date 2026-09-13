import * as TanStack from "@tanstack/react-table"
import { EditableGrid2Props, EditableGrid2RowUpdate } from "./types-public"
import { checkIfCellReadOnly, ColumnMetadataInternal } from "./types-internal"
import { RowAccessor } from "./useRowAccessor"

/**
 * セルへの文字列の書き込み1件。
 * colIndex は可視リーフ列（行チェックボックス列を含む）の中でのインデックス。
 */
export type CellTextWrite = {
  rowIndex: number
  colIndex: number
  /**
   * エディタに入力されたテキスト。
   * テキストのフォーマットや数値変換などがかかる前の状態。
   */
  text: string
}

/**
 * グリッドの操作（セル編集の確定・貼り付け・Deleteキーによるクリア）による値の変更を一括で反映する。
 *
 * 変更はすべて dispatch を経由し、列定義の setText で新しい行オブジェクトを作ってから、
 * 1回の操作につき1回だけ onRowsChange を呼ぶ。
 * React Hook Form の setValue のように1回ごとのコストが高い反映先でも、
 * 呼び出し回数がセルの数ではなく行の数で済むようにするため。
 */
export const useBatchDispatcher = <TRow,>(
  visibleLeafColumns: TanStack.Column<string, unknown>[],
  rowKeys: string[],
  getRowObject: RowAccessor<TRow>,
  props: EditableGrid2Props<TRow>,
) => {

  /**
   * そのセルに書き込めるかどうか。
   * 範囲外のセル、setText が定義されていない列、読み取り専用のセルは書き込めない。
   */
  const isCellWritable = (rowIndex: number, colIndex: number): boolean => {
    if (rowIndex < 0 || rowIndex >= rowKeys.length) return false

    const column = visibleLeafColumns[colIndex]
    if (!column) return false

    const meta = column.columnDef.meta as ColumnMetadataInternal<TRow>
    if (!meta.original?.setText) return false

    return !checkIfCellReadOnly(meta, rowIndex, props.isReadOnly, getRowObject(rowIndex))
  }

  /**
   * 書き込みを行単位にまとめて onRowsChange を1回呼ぶ。
   * 同じ行の複数のセルへの書き込みは、前の列の setText の戻り値に次の列の setText を適用する。
   * 書き込めないセルや、setText が undefined を返したセルはスキップする。
   */
  const dispatch = (writes: CellTextWrite[]) => {
    const changedRows = new Map<number, { row: TRow, changedColumnIds: Set<string> }>()

    for (const { rowIndex, colIndex, text } of writes) {
      if (!isCellWritable(rowIndex, colIndex)) continue

      const meta = visibleLeafColumns[colIndex].columnDef.meta as ColumnMetadataInternal<TRow>
      const changed = changedRows.get(rowIndex)
      const current = changed?.row ?? getRowObject(rowIndex)
      const next = meta.original!.setText!(current, text, rowIndex)

      // 書き込み不可、または値に変化が無い
      if (next === undefined || next === current) continue

      if (changed) {
        changed.row = next
        changed.changedColumnIds.add(meta.columnId)
      } else {
        changedRows.set(rowIndex, { row: next, changedColumnIds: new Set([meta.columnId]) })
      }
    }

    if (changedRows.size === 0) return

    const updates: EditableGrid2RowUpdate<TRow>[] = Array.from(changedRows, ([rowIndex, { row, changedColumnIds }]) => ({
      rowIndex,
      rowKey: rowKeys[rowIndex],
      row,
      changedColumnIds: Array.from(changedColumnIds),
    }))
    props.onRowsChange?.(updates)
  }

  return { isCellWritable, dispatch }
}

/**
 * @see {@link useBatchDispatcher}
 */
export type BatchDispatcher = ReturnType<typeof useBatchDispatcher>
