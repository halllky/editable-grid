import React from "react"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

/** データ1行分のデータ構造 */
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

/**
 * 最小限の実装の実演画面
 */
function MinimalExample() {

  // 大元のデータ配列
  const [rows, setRows] = React.useState<TestRow[]>(getDefaultValues)

  // 行のキー。行インデックスではなく、行が動いても変わらない値を使う。
  const rowKeys = React.useMemo(() => {
    return rows.map(row => row.id)
  }, [rows])

  // 行のキーまたはインデックスを受け取り、その時点の最新の行データを返す。
  const getLatestRowObject = React.useCallback((index: number) => {
    return rows[index]
  }, [rows])

  // 列定義。
  // useMemo で参照を安定させる。
  // 指定が必要な属性が多いので、実際のアプリケーション開発時は
  // 「文字列用列定義ベース」「数値用列定義ベース」など種類ごとにベースとなる設定を用意しておき
  // それを各画面で使いまわすと開発がやりやすくなる。
  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [
    // 商品名の列
    col.leaf({
      columnId: "name",
      renderHeader: () => <CellText>商品名</CellText>,
      getValuesForRender: row => [row.name],
      renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
      editor: TextEditor,
      cellToText: row => row.name,
      textToCell: (row, text) => ({ ...row, name: text }),
    }),

    // 数量の列
    col.leaf({
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
    }),
  ], [])

  // セル編集やクリップボードからの貼り付けなどの入力の確定時処理。
  // グリッドの操作による変更を state に反映する。
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    setRows(prev => {
      const next = [...prev]
      for (const { rowIndex, row } of updates) next[rowIndex] = row
      return next
    })
  }, [])

  return (
    // このデモでは Tailwind CSS を使っているが、必須ではない
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

// セル編集時に使われるエディタ。
// セル編集のページで詳しく解説しているのでそちらを参照
const TextEditor = createTextCellEditor(false)

// TypeScript の型推論の補助。
// 内部で何か処理をしているわけではなく、引数をそのまま返すだけの関数。
// 利用は必須ではない。
const col = EG2.createColumnHelper<TestRow>()

/**
 * セルのレンダリングコンポーネント。
 * ここでは Tailwind CSS を使っているが、必須ではない。
 * 色や表示形式など自由に指定可能。
 */
function CellText(props: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

// --------------------------------------------
// 以降はデモ用の設定。グリッドとは無関係

const storybookSetting: Meta<typeof MinimalExample> = {
  title: "基本の使い方/最小限の実装",
  component: MinimalExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 最小限の実装: StoryObj<typeof storybookSetting> = {}
