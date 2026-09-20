import { EditableGrid2Deps, EditableGrid2GroupColumn, EditableGrid2LeafColumn } from "./types-public"

/**
 * 列定義の型推論を補助する関数を返す。
 *
 * 列定義の配列リテラルに直接書いた場合、renderBody の引数 deps の型は any になる。
 * この関数が返す leaf で包むと any になるのを回避できる。
 * 実行時には引数をそのまま返すだけで、何もしない。
 *
 * @example
 * const col = createColumnHelper<Row>()
 * const columns: EditableGrid2Column<Row>[] = [
 *   col.leaf({
 *     columnId: "status",
 *     getValuesForRender: row => [row.status],
 *     renderBody: ({ deps: [status] }) => <span>{status}</span>, // status は Row["status"] 型
 *     ...
 *   }),
 * ]
 */
export function createColumnHelper<TRow>() {
  return {
    /** グループ化されていない列 */
    leaf: <const TDeps extends EditableGrid2Deps = []>(
      column: EditableGrid2LeafColumn<TRow, TDeps>
    ): EditableGrid2LeafColumn<TRow, TDeps> => column,
    /** グループ化された列 */
    group: (
      column: EditableGrid2GroupColumn<TRow>
    ): EditableGrid2GroupColumn<TRow> => column,
  }
}
