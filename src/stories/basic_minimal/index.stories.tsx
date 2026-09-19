import React from "react"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

/**
 * 最小限の実装の実演画面。
 *
 * 行データを React の state で持ち、グリッドには以下を渡す。
 * - rowKeys: 行を一意に識別する文字列の配列
 * - getLatestRowObject: 行インデックスから行の値を返す関数
 * - onRowsChange: グリッドの操作による変更の反映先
 * - columns: 列定義
 */
function MinimalExample() {

  const [rows, setRows] = React.useState<TestRow[]>(getDefaultValues)

  // 行のキー。行インデックスではなく、行が動いても変わらない値を使う。
  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])

  // rows が変わると参照が変わり、それを合図にグリッドが表示中のセルの値を取得し直す。
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  // グリッドの操作（編集確定・貼り付け・Delete）による変更を state に反映する
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    setRows(prev => {
      const next = [...prev]
      for (const { rowIndex, row } of updates) next[rowIndex] = row
      return next
    })
  }, [])

  // 列定義。セルを編集するたびにこのコンポーネントが再レンダリングされるため、useMemo で参照を安定させる。
  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名</CellText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    editor: TextEditor,
    cellToText: row => row.name,
    textToCell: (row, text) => ({ ...row, name: text }),
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
    editor: TextEditor,
    cellToText: row => String(row.quantity ?? ""),
    textToCell: (row, text) => {
      if (text.trim() === "") return { ...row, quantity: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined // 数値でなければ書き込まない
    },
  })], [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500"
      />
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  id: string
  name: string
  quantity?: number
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { id: "1", name: "りんご", quantity: 3 },
    { id: "2", name: "みかん", quantity: 12 },
    { id: "3", name: "ぶどう", quantity: 2 },
  ]
}

/** セルの基本的スタイルを施したもの */
function CellText(props: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof MinimalExample> = {
  title: "基本の使い方/最小限の実装",
  component: MinimalExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 最小限の実装: StoryObj<typeof storybookSetting> = {}
