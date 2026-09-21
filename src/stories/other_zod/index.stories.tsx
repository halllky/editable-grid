import React from "react"
import * as z from "zod"
import { EditableGrid, EditableGridColumn, EditableGridRowUpdate, createColumnHelper } from "../../EditableGrid"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

/** データ1行分のデータ構造 */
type TestRow = {
  id: string
  name: string
  quantity?: number
  unitPrice?: number
}

/**
 * 1行分のスキーマ。
 * プロパティ名を列IDと一致させておくと、検証結果を列に振り分けるのが単純に済む。
 */
const rowSchema = z.object({
  name: z.string().min(1, "商品名を入力してください。").max(10, "商品名は10文字以内で入力してください。"),
  quantity: z.number("数量を入力してください。").int("数量は整数で入力してください。").positive("数量は1以上で入力してください。"),
  unitPrice: z.number("単価を入力してください。").nonnegative("単価に負の数は指定できません。"),
})

/** 検証の対象になる列 */
type ValidatedColumnId = keyof typeof rowSchema.shape

/** エラーを「行のキー → 列ID → メッセージ」の形に索引付けしたもの */
type CellErrorIndex = ReadonlyMap<string, Partial<Record<ValidatedColumnId, string>>>

/** 1行分を検証し、「列ID → メッセージ」の形で返す。 */
function validateRow(row: TestRow): Partial<Record<ValidatedColumnId, string>> {
  const result = rowSchema.safeParse(row)
  if (result.success) return {}

  const errors: Partial<Record<ValidatedColumnId, string>> = {}
  for (const issue of result.error.issues) {
    const columnId = issue.path[0] as ValidatedColumnId
    errors[columnId] ??= issue.message // 同じ項目に複数の指摘がある場合は先頭だけ表示する
  }
  return errors
}

/**
 * 1行のうち、指定された列だけを検証する。
 * スキーマ全体ではなく `shape` から列のスキーマを取り出して使う。
 * エラーが無い列にも undefined を入れて返すことで、
 * 保持している検証結果に上書きするだけで直ったセルのエラーが消えるようにしている。
 */
function validateColumns(row: TestRow, columnIds: readonly ValidatedColumnId[]) {
  const errors: Partial<Record<ValidatedColumnId, string>> = {}
  for (const columnId of columnIds) {
    const result = rowSchema.shape[columnId].safeParse(row[columnId])
    errors[columnId] = result.success ? undefined : result.error.issues[0].message
  }
  return errors
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { id: "1", name: "りんご", quantity: 10, unitPrice: 120 },
    { id: "2", name: "ドラゴンフルーツ", quantity: 3, unitPrice: 900 },
    { id: "3", name: "", quantity: 0, unitPrice: 250 },
  ]
}

/**
 * zod との統合の実演画面。
 */
function ZodExample() {

  const [rows, setRows] = React.useState<TestRow[]>(getDefaultValues)

  // 検証結果。セルの描画のたびに検証し直すのではなく、検証したタイミングの結果を保持する。
  const [errors, setErrors] = React.useState<CellErrorIndex>(() => new Map(
    getDefaultValues().map(row => [row.id, validateRow(row)])
  ))

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  // そのセルに表示するエラーメッセージを返す関数
  const getCellError = React.useCallback((row: TestRow, columnId: ValidatedColumnId) => {
    return errors.get(row.id)?.[columnId]
  }, [errors])

  // グリッドの操作（編集確定・貼り付け・Delete）による変更を state に反映し、変更された列だけ検証し直す。
  const handleRowsChange = React.useCallback((updates: EditableGridRowUpdate<TestRow>[]) => {
    setRows(prev => {
      const next = [...prev]
      for (const { rowIndex, row } of updates) next[rowIndex] = row
      return next
    })

    setErrors(prev => {
      const next = new Map(prev)
      for (const { row, changedColumnIds } of updates) {
        // 編集していない隣の未入力のセルまでエラーになるのが嫌なので、行全体ではなく変更された列だけを検証する
        const columnIds = changedColumnIds.filter(isValidatedColumnId)
        if (columnIds.length === 0) continue
        next.set(row.id, { ...next.get(row.id), ...validateColumns(row, columnIds) })
      }
      return next
    })
  }, [])

  // 送信時のつもり。全行・全列を検証する。
  const validateAll = () => {
    setErrors(new Map(rows.map(row => [row.id, validateRow(row)])))
  }

  const nextRowId = React.useRef(100)
  const addRow = () => {
    setRows(prev => [...prev, { id: `R${nextRowId.current++}`, name: "" }])
  }

  const columns = React.useMemo((): EditableGridColumn<TestRow>[] => [col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名</CellText>,
    // エラーメッセージも deps に含める。含めない場合、
    // 値が変わっていないのにエラーだけが変わったときにセルの表示が古いままになる。
    getValuesForRender: row => [row.name, getCellError(row, "name")],
    renderBody: ({ deps: [name, error] }) => <CellText error={error}>{name}</CellText>,
    editor: TextEditor,
    cellToText: row => row.name,
    textToCell: (row, text) => ({ ...row, name: text }),
    defaultWidth: 160,
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: row => [row.quantity, getCellError(row, "quantity")],
    renderBody: ({ deps: [quantity, error] }) => <CellText error={error}>{quantity}</CellText>,
    editor: TextEditor,
    cellToText: row => String(row.quantity ?? ""),
    // スキーマに渡す前に数値にしておく。セルエディタやクリップボードから渡ってくるのは文字列のため。
    textToCell: (row, text) => toNumberCell(row, "quantity", text),
    defaultWidth: 96,
  }), col.leaf({
    columnId: "unitPrice",
    renderHeader: () => <CellText>単価</CellText>,
    getValuesForRender: row => [row.unitPrice, getCellError(row, "unitPrice")],
    renderBody: ({ deps: [unitPrice, error] }) => <CellText error={error}>{unitPrice}</CellText>,
    editor: TextEditor,
    cellToText: row => String(row.unitPrice ?? ""),
    textToCell: (row, text) => toNumberCell(row, "unitPrice", text),
    defaultWidth: 96,
  })], [getCellError])

  return (
    <div className="flex flex-col items-start gap-2 p-2">
      <div className="flex gap-2">
        <button type="button" onClick={addRow} className="px-2 py-1 text-sm border border-gray-500 cursor-pointer">
          行を追加する（※1）
        </button>
        <button type="button" onClick={validateAll} className="px-2 py-1 text-sm border border-gray-500 cursor-pointer">
          すべての行を検証する（※1）
        </button>
      </div>

      <ul className="text-sm mb-2">
        <li>
          ※1 セルを編集したときは編集した列だけを検証しているため、追加した行の未入力のセルはすぐにはエラーになりません。
          「すべての行を検証する」を押すと、行全体をスキーマにかけた結果に変わります。
        </li>
      </ul>

      <EditableGrid
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500"
      />
    </div>
  )
}

/** changedColumnIds のような文字列の列IDを、検証の対象の列に絞り込むためのもの */
const isValidatedColumnId = (columnId: string): columnId is ValidatedColumnId => (
  columnId in rowSchema.shape
)

/** セルエディタやクリップボードから渡ってきた文字列を数値にして行に書き込む。 */
function toNumberCell(row: TestRow, key: "quantity" | "unitPrice", text: string): TestRow | undefined {
  if (text.trim() === "") return { ...row, [key]: undefined }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? { ...row, [key]: parsed } : undefined // 数値でなければ書き込まない
}

// セル編集時に使われるエディタ。
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = createColumnHelper<TestRow>()

/**
 * セル表示コンポーネント。
 * エラーがある場合は枠線と文字色を変え、メッセージをツールチップで表示する。
 */
function CellText({ children, error }: {
  children?: React.ReactNode
  error?: string
}) {
  return (
    <span
      title={error}
      className={`flex-1 min-w-0 px-1 py-px border text-sm truncate ${error
        ? "border-rose-600 text-rose-600"
        : "border-transparent"}`}
    >
      {children}
    </span>
  )
}

const storybookSetting: Meta<typeof ZodExample> = {
  title: "その他/zod との統合",
  component: ZodExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const zodとの統合: StoryObj<typeof storybookSetting> = {}
