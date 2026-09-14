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
 * セル選択の実演画面。
 *
 * セル選択・範囲選択・キーボード操作は EditableGrid2 に組み込まれており、
 * 有効にするための専用のプロパティは無い。
 * この画面では、Ctrl + 矢印キーでの端までの移動や自動スクロールを試せるよう
 * 行数・列数を多めにとり、グリッドの高さを固定している。
 */
function CellSelectionExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const gridRef = React.useRef<EG2.EditableGrid2Ref<TestRow>>(null)
  const getLatestRowObject = React.useCallback((index: number) => getValues(`rows.${index}`), [getValues])

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

  // フォーカスが外れたときに選択を解除するかどうか
  const [clearSelectionOnBlur, setClearSelectionOnBlur] = React.useState(false)

  // ref API で取得した選択行の表示用
  const showSelectedRows = () => {
    const rows = gridRef.current?.getSelectedRows() ?? []
    window.alert(rows.length === 0
      ? "選択されている行はありません。"
      : `選択されている行の商品名は、${rows.map(({ row, rowIndex }) => `${row.name}(${rowIndex + 1}行目)`).join("、")}です。`
    )
  }

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    columnId: "no",
    renderHeader: () => <CellText>No.</CellText>,
    renderBody: ({ rowIndex }) => <CellText>{rowIndex + 1}</CellText>,
    defaultWidth: 48,
    disableResizing: true,
    isFixed: true,
  }), col.leaf({
    columnId: "name",
    editor: TextEditor,
    toText: row => row.name ?? "",
    fromText: (row, text) => ({ ...row, name: text }),
    renderHeader: () => <CellText>商品名</CellText>,
    getValueForRerender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 128,
    isFixed: true,
  }), col.leaf({
    columnId: "category",
    editor: TextEditor,
    toText: row => row.category ?? "",
    fromText: (row, text) => ({ ...row, category: text }),
    renderHeader: () => <CellText>区分</CellText>,
    getValueForRerender: row => [row.category],
    renderBody: ({ deps: [category] }) => <CellText>{category}</CellText>,
    defaultWidth: 96,
  }), col.leaf({
    columnId: "unitPrice",
    editor: TextEditor,
    toText: row => String(row.unitPrice ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, unitPrice: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, unitPrice: parsed } : undefined
    },
    renderHeader: () => <CellText>単価</CellText>,
    getValueForRerender: row => [row.unitPrice],
    renderBody: ({ deps: [unitPrice] }) => <CellText>{unitPrice}</CellText>,
    defaultWidth: 88,
  }), col.leaf({
    columnId: "quantity",
    editor: TextEditor,
    toText: row => String(row.quantity ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, quantity: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
    },
    // 数量（キー操作のカスタマイズ） ここから
    // + / - キーは本来クイック編集の開始キーだが、
    // preventDefault を呼ぶことでグリッドの既定の動作をキャンセルし、値の増減に置き換えている。
    onCellKeyDown: ({ row, rowIndex, event }) => {
      if (event.key !== "+" && event.key !== "-") return
      event.preventDefault()
      const current = row.quantity ?? 0
      setValue(`rows.${rowIndex}.quantity`, Math.max(0, current + (event.key === "+" ? 1 : -1)))
    },
    // 数量（キー操作のカスタマイズ） ここまで
    renderHeader: () => <CellText>数量（※1）</CellText>,
    getValueForRerender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
    defaultWidth: 96,
  }), col.leaf({
    columnId: "supplier",
    editor: TextEditor,
    toText: row => row.supplier ?? "",
    fromText: (row, text) => ({ ...row, supplier: text }),
    renderHeader: () => <CellText>仕入先</CellText>,
    getValueForRerender: row => [row.supplier],
    renderBody: ({ deps: [supplier] }) => <CellText>{supplier}</CellText>,
    defaultWidth: 128,
  }), col.leaf({
    columnId: "location",
    editor: TextEditor,
    toText: row => row.location ?? "",
    fromText: (row, text) => ({ ...row, location: text }),
    renderHeader: () => <CellText>保管場所</CellText>,
    getValueForRerender: row => [row.location],
    renderBody: ({ deps: [location] }) => <CellText>{location}</CellText>,
    defaultWidth: 112,
  }), col.leaf({
    columnId: "note",
    editor: TextEditor,
    toText: row => row.note ?? "",
    fromText: (row, text) => ({ ...row, note: text }),
    renderHeader: () => <CellText>備考</CellText>,
    getValueForRerender: row => [row.note],
    renderBody: ({ deps: [note] }) => <CellText>{note}</CellText>,
    defaultWidth: 240,
  })], [setValue])

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={clearSelectionOnBlur}
            onChange={e => setClearSelectionOnBlur(e.target.checked)}
            className="cursor-pointer"
          />
          フォーカスが外れたら選択を解除する
        </label>
        <button
          type="button"
          onClick={() => gridRef.current?.selectRow(2, 4)}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          3～5行目を選択する
        </button>
        <button
          type="button"
          onClick={showSelectedRows}
          className="inline-block px-2 border border-gray-500 bg-white cursor-pointer"
        >
          選択中の行を取得する
        </button>
      </div>

      <EG2.EditableGrid2
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}
        columns={columns}
        clearSelectionOnBlur={clearSelectionOnBlur}
        className="h-80 border border-gray-500 resize-y"
      />

      <ul className="text-sm">
        <li>※1：+ キー / - キーで値を増減できる（onCellKeyDown によるキー操作のカスタマイズ）</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  name?: string
  category?: string
  unitPrice?: number
  quantity?: number
  supplier?: string
  location?: string
  note?: string
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  const items: Pick<TestRow, "name" | "category" | "unitPrice">[] = [
    { name: "りんご", category: "食品", unitPrice: 120 },
    { name: "みかん", category: "食品", unitPrice: 80 },
    { name: "ぶどう", category: "食品", unitPrice: 400 },
    { name: "バナナ", category: "食品", unitPrice: 150 },
    { name: "洗剤", category: "日用品", unitPrice: 250 },
    { name: "ティッシュ", category: "日用品", unitPrice: 300 },
    { name: "歯ブラシ", category: "日用品", unitPrice: 180 },
    { name: "乾電池", category: "その他", unitPrice: 500 },
  ]
  const suppliers = ["山田商店", "佐藤物産", "鈴木食品"]
  const locations = ["倉庫A-1", "倉庫A-2", "倉庫B-1", "店頭"]

  return Array.from({ length: 30 }).map((_, i) => ({
    rowId: i.toFixed(),
    ...items[i % items.length],
    quantity: (i * 7) % 20 + 1,
    supplier: suppliers[i % suppliers.length],
    location: locations[i % locations.length],
    note: "",
  }))
}

/** セルの基本的スタイルを施したもの */
function CellText(props: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof CellSelectionExample> = {
  title: "選択/セル選択",
  component: CellSelectionExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const セル選択: StoryObj<typeof storybookSetting> = {}
