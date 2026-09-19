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
 * 列定義の実演画面。
 *
 * - renderHeader / renderBody によるヘッダ・セルの描画
 * - セル内のボタン
 * - グリッドの外側の state に依存する列
 * - 列固定・グルーピング・列幅
 */
function ColumnsExample() {

  const [rows, setRows] = React.useState<TestRow[]>(getDefaultValues)
  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  // グリッドの操作（編集確定・貼り付け・Delete）による変更を state に反映する
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    setRows(prev => {
      const next = [...prev]
      for (const { rowIndex, row } of updates) next[rowIndex] = row
      return next
    })
  }, [])

  // グリッドの外側の state。金額列の表示に使う。
  const [includeTax, setIncludeTax] = React.useState(false)

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    // 削除ボタン ここから
    columnId: "delete",
    renderHeader: () => null,
    renderBody: ({ rowKey }) => (
      <button
        type="button"
        // セルの選択が動かないよう、mousedown をグリッドに伝えない
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setRows(prev => prev.filter(row => row.id !== rowKey))}
        className="w-full text-xs text-sky-700 underline cursor-pointer"
      >
        削除
      </button>
    ),
    defaultWidth: 48,
    disableResizing: true,
    isFixed: true,
    // 削除ボタン ここまで
  }), col.leaf({
    // 商品コード（isFixed 未指定だが、右の商品名列が固定のため固定される）
    columnId: "code",
    renderHeader: () => <CellText>商品コード（※1）</CellText>,
    getValuesForRender: row => [row.code],
    renderBody: ({ deps: [code] }) => <CellText>{code}</CellText>,
    editor: TextEditor,
    cellToText: row => row.code,
    textToCell: (row, text) => ({ ...row, code: text }),
    defaultWidth: 140,
  }), col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名</CellText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    editor: TextEditor,
    cellToText: row => row.name,
    textToCell: (row, text) => ({ ...row, name: text }),
    isFixed: true,
  }), col.group({
    // 価格（グループ列） ここから
    columnId: "price",
    renderHeader: () => <CellText>価格（※2）</CellText>,
    columns: [col.leaf({
      columnId: "unitPrice",
      renderHeader: () => <CellText>単価</CellText>,
      getValuesForRender: row => [row.unitPrice],
      renderBody: ({ deps: [unitPrice] }) => <CellText align="right">{unitPrice?.toLocaleString()}</CellText>,
      editor: TextEditor,
      cellToText: row => String(row.unitPrice ?? ""),
      textToCell: (row, text) => {
        if (text.trim() === "") return { ...row, unitPrice: undefined }
        const parsed = Number(text)
        return Number.isFinite(parsed) ? { ...row, unitPrice: parsed } : undefined
      },
      defaultWidth: 80,
    }), col.leaf({
      columnId: "quantity",
      renderHeader: () => <CellText>数量</CellText>,
      getValuesForRender: row => [row.quantity],
      renderBody: ({ deps: [quantity] }) => <CellText align="right">{quantity?.toLocaleString()}</CellText>,
      editor: TextEditor,
      cellToText: row => String(row.quantity ?? ""),
      textToCell: (row, text) => {
        if (text.trim() === "") return { ...row, quantity: undefined }
        const parsed = Number(text)
        return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
      },
      defaultWidth: 64,
    }), col.leaf({
      // 金額（グリッドの外側の state に依存する列） ここから
      // includeTax は columns の useMemo の依存配列に含める。
      columnId: "amount",
      isReadOnly: true,
      renderHeader: () => <CellText>{includeTax ? "金額（税込）" : "金額（税抜）"}</CellText>,
      getValuesForRender: row => [calcAmount(row, includeTax)],
      renderBody: ({ deps: [amount] }) => <CellText align="right">{amount.toLocaleString()}</CellText>,
      cellToText: row => String(calcAmount(row, includeTax)),
      defaultWidth: 104,
      // 金額（グリッドの外側の state に依存する列） ここまで
    })],
    // 価格（グループ列） ここまで
  }), col.leaf({
    columnId: "note",
    renderHeader: () => <CellText>備考（※3）</CellText>,
    getValuesForRender: row => [row.note],
    renderBody: ({ deps: [note] }) => <CellText>{note}</CellText>,
    editor: TextEditor,
    cellToText: row => row.note,
    textToCell: (row, text) => ({ ...row, note: text }),
    defaultWidth: 640,
  })], [includeTax])

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="self-start flex items-center gap-1 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeTax}
          onChange={e => setIncludeTax(e.target.checked)}
          className="cursor-pointer"
        />
        金額を税込で表示する
      </label>

      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500"
      />

      <ul className="text-sm">
        <li>※1：isFixed を指定していないが、右隣の商品名列が固定のため固定される</li>
        <li>※2：単価・数量・金額の3列をまとめたグループ列</li>
        <li>※3：横スクロールで固定列の効果を確かめられるよう、幅を広くとっている</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  id: string
  code: string
  name: string
  unitPrice?: number
  quantity?: number
  note: string
}

/** 金額の計算 */
function calcAmount(row: TestRow, includeTax: boolean): number {
  const amount = (row.unitPrice ?? 0) * (row.quantity ?? 0)
  return includeTax ? Math.floor(amount * 1.1) : amount
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { id: "1", code: "F-001", name: "りんご", unitPrice: 120, quantity: 3, note: "" },
    { id: "2", code: "F-002", name: "みかん", unitPrice: 80, quantity: 12, note: "箱買い" },
    { id: "3", code: "F-003", name: "ぶどう", unitPrice: 400, quantity: 2, note: "" },
    { id: "4", code: "D-001", name: "洗剤", unitPrice: 250, quantity: 1, note: "" },
    { id: "5", code: "D-002", name: "ティッシュ", unitPrice: 300, quantity: 20, note: "" },
  ]
}

/** セルの基本的スタイルを施したもの */
function CellText(props: {
  children?: React.ReactNode
  align?: "right"
}) {
  return (
    <span className={`flex-1 px-1 py-px border border-transparent text-sm truncate ${props.align === "right" ? "text-right" : ""}`}>
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof ColumnsExample> = {
  title: "基本の使い方/列定義",
  component: ColumnsExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 列定義: StoryObj<typeof storybookSetting> = {}
