import { GridColumnDef, GridColumnHelper } from "../types-internal"

/** 行ヘッダー列のID */
export const ROW_HEADER_COLUMN_ID = "hallky-eg2-row-header"

/**
 * 行ヘッダのチェックボックス列を作成する
 */
export function createRowCheckBoxColumn(
  columnHelper: GridColumnHelper,
): GridColumnDef {

  return columnHelper.display({
    id: ROW_HEADER_COLUMN_ID,
    size: 40,
    enableResizing: false,
    // 範囲選択の対象外（クリックしても選択されず、矢印キーでの移動でも飛ばされる）
    enableCellSelection: false,
    meta: {
      columnId: ROW_HEADER_COLUMN_ID,
      original: null,
      isReadOnly: false,
      isGroupedColumn: false,
      isRowCheckBox: true,
    },

    // テーブル左上の角の全選択チェックボックス
    header: ctx => (
      <label
        className="halllky-eg2-checkbox-header-label"
        onClick={e => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={ctx.table.getIsAllRowsSelected()}
          onChange={ctx.table.getToggleAllRowsSelectedHandler()}
          aria-label="全行選択"
          className="halllky-eg2-checkbox"
        />
      </label>
    ),

    // ボディの行の列ヘッダ
    cell: ctx => {
      return (
        <label
          className="halllky-eg2-checkbox-cell-label"
          style={{ width: ctx.column.getSize() }}
        >
          {ctx.row.getCanSelect() && (
            <input
              type="checkbox"
              checked={ctx.row.getIsSelected()}
              onChange={ctx.row.getToggleSelectedHandler()}
              aria-label={`行${ctx.row.index + 1}を選択`}
              className="halllky-eg2-checkbox"
            />
          )}
        </label>
      )
    },
  })
}
