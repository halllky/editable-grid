import * as TanStack from "@tanstack/react-table"
import { EditableGridFooterCellRenderer, EditableGridFooterRenderer, EditableGridLeafColumn } from "./types-public"

/** このフォルダ内部でのみ使用。外部から使われる想定はない */
export type ColumnMetadataInternal<TRow> = {
  /**
   * リーフ列のインデックス。
   */
  columnId: string
  /**
   * 元の列定義。呼び出し側の columns が再評価されるたびに最新の内容を返す
   * （列そのものが消えた場合は null）。行チェックボックス列・グループ列の場合は null。
   */
  readonly original: EditableGridLeafColumn<TRow> | null
  /** 呼び出し側の columns が再評価されるたびに最新の値を返す。 */
  readonly isReadOnly: boolean | ((row: TRow, rowIndex: number) => boolean)
  isGroupedColumn: boolean
  isRowCheckBox: boolean
}

/**
 * EditableGrid が TanStack Table に登録する機能。
 * 固定列は columnPinning、範囲選択は cellSelection で管理する。
 */
export const gridFeatures = TanStack.tableFeatures({
  rowSelectionFeature: TanStack.rowSelectionFeature,
  cellSelectionFeature: TanStack.cellSelectionFeature,
  columnVisibilityFeature: TanStack.columnVisibilityFeature,
  columnOrderingFeature: TanStack.columnOrderingFeature, // column.getIndex() のため
  columnPinningFeature: TanStack.columnPinningFeature,
  columnSizingFeature: TanStack.columnSizingFeature,
  columnResizingFeature: TanStack.columnResizingFeature,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columnMeta: TanStack.metaHelper<ColumnMetadataInternal<any>>(),
})

/**
 * TanStack Table に渡す行データ。
 * 行の値は持たず、行のキーだけを持つ（TanStack Table v9 は行データにオブジェクトか配列を要求するため包んでいる）。
*/
export type GridRow = { rowKey: string }

// TanStack の各種型定義は TanStack.tableFeatures と連動しているので
// ここで宣言したものを import して使うこと。
export type GridFeatures = typeof gridFeatures

/**
 * TanStack Table の state のうちグリッド全体の再描画をするものがどれかを選ぶ関数。
 * 
 * 逆に、ここで選ばれなかった state に依存して再レンダリングしたい部分がある場合は
 * `<table.Subscribe source={table.atoms.cellSelection}>` で囲むとそれをトリガーにできる。
 */
export function selectGridState(state: TanStack.TableState<GridFeatures>): Partial<TanStack.TableState<GridFeatures>> {
  // セル選択は更新頻度が高いのと、セル本体とは別のDOMで描いており
  // グリッド本体のレンダリングには影響しないので、外す。
  const { cellSelection, ...rest } = state
  return rest
}

/** グリッド本体が購読する state。 @see selectGridState */
export type GridTableState = ReturnType<typeof selectGridState>

export type GridTable = TanStack.ReactTable<GridFeatures, GridRow, GridTableState>
export type GridColumn = TanStack.Column<GridFeatures, GridRow, unknown>
export type GridColumnDef = TanStack.ColumnDef<GridFeatures, GridRow, unknown>
export type GridColumnHelper = TanStack.ColumnHelper<GridFeatures, GridRow>
export type GridHeader = TanStack.Header<GridFeatures, GridRow, unknown>
export type GridCell = TanStack.Cell<GridFeatures, GridRow, unknown>

/** 推定行高さ */
export const ESTIMATED_ROW_HEIGHT = 24
/** 行ヘッダー列の幅 */
export const ROW_HEADER_WIDTH = 32
/** デフォルトの列幅。8rem をピクセル換算。環境依存可能性あり */
export const DEFAULT_COLUMN_WIDTH = 128

/** 列定義の renderFooter を段ごとのレンダリング関数の配列に揃える */
export function normalizeFooterRenderers(
  renderFooter: EditableGridFooterRenderer | undefined
): EditableGridFooterCellRenderer[] {
  if (renderFooter === undefined) return []
  return Array.isArray(renderFooter) ? renderFooter : [renderFooter]
}

/**
 * セルが読み取り専用かどうかを判定する。
 * グリッド全体の読み込み専用、列の読み取り専用設定、行ごとの読み取り専用設定を考慮する。
 */
export function checkIfCellReadOnly<TRow>(
  columnMeta: ColumnMetadataInternal<TRow>,
  rowIndex: number,
  gridIsReadOnly: boolean | ((row: TRow, rowIndex: number) => boolean) | undefined,
  originalRow: TRow
): boolean {

  // グリッド全体の読み取り専用
  if (gridIsReadOnly === true) {
    return true
  }

  // 行単位の読み取り専用
  if (typeof gridIsReadOnly === 'function' && gridIsReadOnly(originalRow, rowIndex)) {
    return true
  }

  // 列単位の読み取り専用
  if (columnMeta.isReadOnly === true) {
    return true
  }
  if (typeof columnMeta.isReadOnly === 'function' && columnMeta.isReadOnly(originalRow, rowIndex)) {
    return true
  }

  return false
}
