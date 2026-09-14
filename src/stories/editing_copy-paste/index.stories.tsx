import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"
import { createSelectCellEditor } from "../editing_cell-editor/createSelectCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const NameEditor = createTextCellEditor(false)
const NoteEditor = createTextCellEditor(true)
const CategoryEditor = createSelectCellEditor(["食品", "日用品", "その他"] satisfies TestRow["category"][])

// 列定義の型推論の補助（getValueForRerender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

/**
 * コピー＆ペースト実演画面。
 *
 * コピー＆ペーストを有効にするための専用のプロパティは無く、
 * 下記の各列のように toText / fromText を定義した列は
 * 自動的にクリップボードとの相互コピペの対象になる。
 */
function CopyPasteExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const getLatestRowObject = React.useCallback((index: number) => getValues(`rows.${index}`), [getValues])

  // React Hook Form の値が変わったことをグリッドに通知する
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: "rows",
    formState: { values: true },
    callback: onChange,
  }), [subscribe])

  // グリッドの操作（編集・貼り付け・Delete）による変更を React Hook Form に反映する。
  // 何セル貼り付けても、1回の貼り付けにつき1回、変更のあった行だけがまとめて渡される。
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    for (const { rowIndex, row } of updates) setValue(`rows.${rowIndex}`, row)
  }, [setValue])

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    columnId: "name",
    // 商品名 エディタ用設定 ここから
    // もっとも基本的なコピペ対象列。
    editor: NameEditor,
    toText: row => row.name ?? "",
    // コピペのロジックは自由に定義できる。
    // ここでは改行コードが含まれた値がペーストされるなどに備え、改行除去したうえで設定している。
    fromText: (row, text) => ({ ...row, name: text.replace(/[\r\n\u2028\u2029]/g, '') }),
    // 商品名 エディタ用設定 ここまで

    renderHeader: () => <CellText>商品名</CellText>,
    getValueForRerender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 160,
  }), col.leaf({
    columnId: "unitPrice",
    // 単価 エディタ用設定 ここから
    // クリップボードから渡ってくる値は常に文字列なので、数値列でも自前でパースする必要がある。
    // パースできない文字列が貼り付けられた場合は undefined を返し、そのセルだけ書き込まずに元の値を保つ。
    editor: NameEditor,
    toText: row => String(row.unitPrice ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, unitPrice: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, unitPrice: parsed } : undefined
    },
    // 単価 エディタ用設定 ここまで

    renderHeader: () => <CellText>単価（※1）</CellText>,
    getValueForRerender: row => [row.unitPrice],
    renderBody: ({ deps: [unitPrice] }) => <CellText>{unitPrice}</CellText>,
    defaultWidth: 96,
  }), col.leaf({
    columnId: "quantity",
    // 数量 エディタ用設定 ここから
    editor: NameEditor,
    toText: row => String(row.quantity ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, quantity: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
    },
    // 数量 エディタ用設定 ここまで

    renderHeader: () => <CellText>数量（※1）</CellText>,
    getValueForRerender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
    defaultWidth: 96,
  }), col.leaf({
    columnId: "amount",
    // 金額（読み取り専用・計算列） ここから
    // toText だけを定義し fromText を定義しないことで、
    // 「コピーはできるがペーストは常にスキップされる列」になる。
    // isReadOnly も併せて true にしているため、Delete キーでのクリアもスキップされる。
    isReadOnly: true,
    toText: row => String((row.unitPrice ?? 0) * (row.quantity ?? 0)),
    // 金額（読み取り専用・計算列） ここまで

    renderHeader: () => <CellText>金額（※2）</CellText>,
    // 計算結果そのものを返すと、単価・数量のどちらが変わっても計算結果が変わったときだけ描画し直される
    getValueForRerender: row => [(row.unitPrice ?? 0) * (row.quantity ?? 0)],
    renderBody: ({ deps: [amount] }) => <CellText>{amount}</CellText>,
    defaultWidth: 96,
  }), col.leaf({
    columnId: "category",
    // 区分 エディタ用設定 ここから
    // 選択肢に無い文字列が貼り付けられた場合は undefined を返して無視することで、
    // 型として許容されない値がセルに入り込むのを防いでいる。
    editor: CategoryEditor,
    toText: row => row.category ?? "",
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, category: undefined }
      return (["食品", "日用品", "その他"] as const).includes(text as NonNullable<TestRow["category"]>)
        ? { ...row, category: text as NonNullable<TestRow["category"]> }
        : undefined
    },
    // 区分 エディタ用設定 ここまで

    renderHeader: () => <CellText>区分（※3）</CellText>,
    getValueForRerender: row => [row.category],
    renderBody: ({ deps: [category] }) => <CellText>{category}</CellText>,
    defaultWidth: 96,
  }), col.leaf({
    columnId: "note",
    // 備考（改行あり） エディタ用設定 ここから
    // セル内に改行を含められる列。TSV上はダブルクォートで囲まれた1セルとして
    // 表現されるため、Excel との間で改行込みのまま相互にコピペできる。
    editor: NoteEditor,
    toText: row => row.note ?? "",
    fromText: (row, text) => ({ ...row, note: text }),
    // 備考（改行あり） エディタ用設定 ここまで

    renderHeader: () => <CellText>備考（※4）</CellText>,
    getValueForRerender: row => [row.note],
    renderBody: ({ deps: [note] }) => <CellText wrap>{note}</CellText>,
    defaultWidth: 200,
  })], [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500 resize-y"
      />
      <ul className="text-sm">
        <li>※1：数字のみ貼り付け可能</li>
        <li>※2：読み取り専用の計算列。コピーはできるがペーストは常にスキップされる</li>
        <li>※3：ドロップダウンで選択できる値のみ貼り付け可能</li>
        <li>※4：改行つき文字列。コピー時にダブルクォーテーションで囲まれます。</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  name?: string
  unitPrice?: number
  quantity?: number
  category?: "食品" | "日用品" | "その他"
  note?: string
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { rowId: "0", name: "りんご", unitPrice: 120, quantity: 3, category: "食品", note: "" },
    { rowId: "1", name: "みかん", unitPrice: 80, quantity: 10, category: "食品", note: "箱買い\n家族用" },
    { rowId: "2", name: "ぶどう", unitPrice: 400, quantity: 2, category: "食品", note: "" },
    { rowId: "3", name: "洗剤", unitPrice: 250, quantity: 1, category: "日用品", note: "" },
    { rowId: "4", name: "ティッシュ", unitPrice: 300, quantity: 5, category: "日用品", note: "" },
  ]
}

/** セルの基本的スタイルを施したもの */
function CellText(props: { wrap?: boolean, children?: React.ReactNode }) {

  const className = props.wrap
    ? "px-1 py-px border border-transparent text-sm truncate whitespace-pre-wrap"
    : "px-1 py-px border border-transparent text-sm truncate"

  return (
    <span className={className}>
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof CopyPasteExample> = {
  title: "編集/コピー＆ペースト",
  component: CopyPasteExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const コピーアンドペースト: StoryObj<typeof storybookSetting> = {}
