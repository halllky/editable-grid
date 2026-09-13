import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValueForRerender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

/**
 * 読み取り専用の実演画面。
 *
 * 読み取り専用は以下の3階層で指定でき、いずれか1つでも該当すればそのセルは読み取り専用になる。
 * - グリッド全体: EditableGrid2 の isReadOnly に true
 * - 行単位: EditableGrid2 の isReadOnly に関数
 * - 列単位: 列定義の isReadOnly に true
 * - セル単位: 列定義の isReadOnly に関数
 */
function ReadOnlyExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const gridRef = React.useRef<EG2.EditableGrid2Ref<TestRow>>(null)

  // React Hook Form の値が変わったことをグリッドに通知する
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: "rows",
    formState: { values: true },
    callback: onChange,
  }), [subscribe])

  // グリッドの操作（編集・貼り付け・Delete）による変更を React Hook Form に反映する
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    for (const { rowIndex, row } of updates) setValue(`rows.${rowIndex}`, row)
  }, [setValue])

  // グリッド全体の読み取り専用
  const [isGridReadOnly, setIsGridReadOnly] = React.useState(false)

  // 行単位の読み取り専用（確定済みの行）。
  // グリッドの再レンダリングを発生させるため、React の state として持つ。
  const [lockedRowIds, setLockedRowIds] = React.useState<ReadonlySet<string>>(() => new Set(["2"]))
  const toggleLock = React.useCallback((rowId: string) => {
    setLockedRowIds(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    // 行ロック切り替えボタン ここから
    // セル内のボタンは読み取り専用とは無関係にクリックできるため、
    // グリッド全体が読み取り専用のときだけ明示的に disabled にしている。
    columnId: "lock",
    getValueForRerender: row => [row.rowId],
    renderBody: ({ deps: [rowId] }) => (
      <button
        type="button"
        disabled={isGridReadOnly}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => toggleLock(rowId)}
        className="w-full text-xs text-sky-700 underline cursor-pointer disabled:text-gray-400 disabled:no-underline disabled:cursor-default"
      >
        {lockedRowIds.has(rowId) ? "解除" : "確定"}
      </button>
    ),
    renderHeader: () => <CellText>行ロック</CellText>,
    defaultWidth: 76,
    disableResizing: true,
    isFixed: true,
    // 行ロック切り替えボタン ここまで
  }), col.leaf({
    columnId: "name",
    editor: TextEditor,
    getText: row => row.name ?? "",
    setText: (row, text) => ({ ...row, name: text }),
    renderHeader: () => <CellText>商品名</CellText>,
    getValueForRerender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 128,
    isFixed: true,
  }), col.leaf({
    // 単価（列単位の読み取り専用） ここから
    // getText / setText が定義されていても、
    // isReadOnly: true の列では編集・ペースト・Delete によるクリアはできない。コピーは可能。
    columnId: "unitPrice",
    isReadOnly: true,
    editor: TextEditor,
    getText: row => String(row.unitPrice ?? ""),
    setText: (row, text) => {
      const parsed = Number(text)
      return text.trim() !== "" && Number.isFinite(parsed) ? { ...row, unitPrice: parsed } : undefined
    },
    renderHeader: () => <CellText>単価（※1）</CellText>,
    getValueForRerender: row => [row.unitPrice],
    renderBody: ({ deps: [unitPrice] }) => <CellText>{unitPrice}</CellText>,
    defaultWidth: 96,
    // 単価（列単位の読み取り専用） ここまで
  }), col.leaf({
    // 数量 エディタ用設定 ここから
    columnId: "quantity",
    editor: TextEditor,
    getText: row => String(row.quantity ?? ""),
    setText: (row, text) => {
      if (text.trim() === "") return { ...row, quantity: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
    },
    renderHeader: () => <CellText>数量</CellText>,
    getValueForRerender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
    defaultWidth: 72,
    // 数量 エディタ用設定 ここまで
  }), col.leaf({
    // 割引率（セル単位の読み取り専用） ここから
    // 列の isReadOnly に関数を渡すと、行ごとに判定される（＝セル単位の読み取り専用）。
    columnId: "discountRate",
    isReadOnly: row => (row.quantity ?? 0) < 10,
    editor: TextEditor,
    getText: row => String(row.discountRate ?? ""),
    setText: (row, text) => {
      if (text.trim() === "") return { ...row, discountRate: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, discountRate: parsed } : undefined
    },
    renderHeader: () => <CellText>割引率%（※2）</CellText>,
    getValueForRerender: row => [row.discountRate],
    renderBody: ({ deps: [discountRate] }) => <CellText>{discountRate}</CellText>,
    defaultWidth: 120,
    // 割引率（セル単位の読み取り専用） ここまで
  }), col.leaf({
    // 金額（読み取り専用・計算列） ここから
    columnId: "amount",
    isReadOnly: true,
    getText: row => String(calcAmount(row)),
    renderHeader: () => <CellText>金額（※1）</CellText>,
    getValueForRerender: row => [calcAmount(row)],
    renderBody: ({ deps: [amount] }) => <CellText>{amount}</CellText>,
    defaultWidth: 96,
    // 金額（読み取り専用・計算列） ここまで
  }), col.leaf({
    // 至急（セル内コントロール） ここから
    // renderBody 内に置いたチェックボックス等は、グリッドの読み取り専用設定では止まらない。
    // 引数の isReadOnly（グリッド全体・行・列の判定結果）を見て、利用側で disabled にする。
    columnId: "urgent",
    getValueForRerender: row => [row.urgent ?? false],
    renderBody: ({ deps: [urgent], rowIndex, isReadOnly }) => (
      <label className={`flex items-center justify-center w-full ${isReadOnly ? "" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={urgent}
          disabled={isReadOnly} // チェックボックスを操作できなくする
          onChange={e => setValue(`rows.${rowIndex}.urgent`, e.target.checked)}
          onMouseDown={e => e.stopPropagation()}
          className={isReadOnly ? "" : "cursor-pointer"}
        />
      </label>
    ),
    renderHeader: () => <CellText>至急（※3）</CellText>,
    defaultWidth: 92,
    // 至急（セル内コントロール） ここまで
  }), col.leaf({
    columnId: "note",
    editor: TextEditor,
    getText: row => row.note ?? "",
    setText: (row, text) => ({ ...row, note: text }),
    renderHeader: () => <CellText>備考</CellText>,
    getValueForRerender: row => [row.note],
    renderBody: ({ deps: [note] }) => <CellText>{note}</CellText>,
    defaultWidth: 160,
  })], [isGridReadOnly, lockedRowIds, toggleLock, setValue])

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="self-start flex items-center gap-1 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isGridReadOnly}
          onChange={e => setIsGridReadOnly(e.target.checked)}
          className="cursor-pointer"
        />
        グリッド全体を読み取り専用にする
      </label>

      <EG2.EditableGrid2
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={index => getValues(`rows.${index}`)}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}

        // true を渡すとグリッド全体が、関数を渡すと行単位で読み取り専用になる。
        isReadOnly={isGridReadOnly ? true : row => lockedRowIds.has(row.rowId)}

        columns={columns}
        className="border border-gray-500 resize-y"
      />
      <ul className="text-sm">
        <li>※1：常に読み取り専用</li>
        <li>※2：セル単位の読み取り専用。数量が10以上の行でのみ入力可能</li>
        <li>※3：セル内のチェックボックス。renderBody の引数 isReadOnly を見て動的に読み取り専用になる</li>
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
  discountRate?: number
  urgent?: boolean
  note?: string
}

/** 金額の計算 */
function calcAmount(row: TestRow | undefined): number {
  if (!row) return 0
  const base = (row.unitPrice ?? 0) * (row.quantity ?? 0)
  const rate = (row.quantity ?? 0) >= 10 ? (row.discountRate ?? 0) : 0
  return Math.round(base * (100 - rate) / 100)
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { rowId: "0", name: "りんご", unitPrice: 120, quantity: 3, urgent: false, note: "" },
    { rowId: "1", name: "みかん", unitPrice: 80, quantity: 12, discountRate: 10, urgent: true, note: "箱買い" },
    { rowId: "2", name: "ぶどう", unitPrice: 400, quantity: 2, urgent: false, note: "確定済み" },
    { rowId: "3", name: "洗剤", unitPrice: 250, quantity: 1, urgent: false, note: "" },
    { rowId: "4", name: "ティッシュ", unitPrice: 300, quantity: 20, discountRate: 5, urgent: false, note: "" },
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

const storybookSetting: Meta<typeof ReadOnlyExample> = {
  title: "編集/読み取り専用",
  component: ReadOnlyExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 読み取り専用: StoryObj<typeof storybookSetting> = {}
