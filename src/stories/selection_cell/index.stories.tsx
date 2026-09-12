import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

/**
 * セル選択の実演画面。
 *
 * セル選択・範囲選択・キーボード操作は EditableGrid2 に組み込まれており、
 * 有効にするための専用のプロパティは無い。
 * この画面では、Ctrl + 矢印キーでの端までの移動や自動スクロールを試せるよう
 * 行数・列数を多めにとり、グリッドの高さを固定している。
 */
function CellSelectionExample() {

  const { control, setValue, getValues } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const gridRef = React.useRef<EG2.EditableGrid2Ref<TestRow>>(null)

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

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [{
    columnId: "no",
    renderHeader: () => <CellText>No.</CellText>,
    renderBody: ({ rowIndex }) => <CellText>{rowIndex + 1}</CellText>,
    defaultWidth: 48,
    disableResizing: true,
    isFixed: true,
  }, {
    columnId: "name",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.name`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.name`, value),
    renderHeader: () => <CellText>商品名</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.name`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 128,
    isFixed: true,
  }, {
    columnId: "category",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.category`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.category`, value),
    renderHeader: () => <CellText>区分</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.category`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 96,
  }, {
    columnId: "unitPrice",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => String(getValues(`rows.${rowIndex}.unitPrice`) ?? ""),
    setValueFromEditor: ({ rowIndex, value }) => {
      if (value.trim() === "") {
        setValue(`rows.${rowIndex}.unitPrice`, undefined)
      } else {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return
        setValue(`rows.${rowIndex}.unitPrice`, parsed)
      }
    },
    renderHeader: () => <CellText>単価</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.unitPrice`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 88,
  }, {
    columnId: "quantity",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => String(getValues(`rows.${rowIndex}.quantity`) ?? ""),
    setValueFromEditor: ({ rowIndex, value }) => {
      if (value.trim() === "") {
        setValue(`rows.${rowIndex}.quantity`, undefined)
      } else {
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) return
        setValue(`rows.${rowIndex}.quantity`, parsed)
      }
    },
    // 数量（キー操作のカスタマイズ） ここから
    // + / - キーは本来クイック編集の開始キーだが、
    // preventDefault を呼ぶことでグリッドの既定の動作をキャンセルし、値の増減に置き換えている。
    onCellKeyDown: ({ rowIndex, event }) => {
      if (event.key !== "+" && event.key !== "-") return
      event.preventDefault()
      const current = getValues(`rows.${rowIndex}.quantity`) ?? 0
      setValue(`rows.${rowIndex}.quantity`, Math.max(0, current + (event.key === "+" ? 1 : -1)))
    },
    // 数量（キー操作のカスタマイズ） ここまで
    renderHeader: () => <CellText>数量（※1）</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.quantity`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 96,
  }, {
    columnId: "supplier",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.supplier`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.supplier`, value),
    renderHeader: () => <CellText>仕入先</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.supplier`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 128,
  }, {
    columnId: "location",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.location`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.location`, value),
    renderHeader: () => <CellText>保管場所</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.location`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 112,
  }, {
    columnId: "note",
    editor: TextEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.note`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.note`, value),
    renderHeader: () => <CellText>備考</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.note`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 240,
  }], [control, getValues, setValue])

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
        getLatestRowObject={index => getValues(`rows.${index}`)}
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
