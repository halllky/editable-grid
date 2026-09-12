import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

/**
 * 行選択の実演画面。
 *
 * showCheckBox を指定すると、グリッドの左端に行選択用のチェックボックス列が追加される。
 * この画面では、全行にチェックボックスを表示するか、行ごとに表示有無を判定するかを切り替えられる。
 * チェックした行は ref の getCheckedRows() で取得し、取得結果の表示や行削除に使っている。
 */
function RowSelectionExample() {

  const { control, setValue, getValues } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields, remove, replace } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const gridRef = React.useRef<EG2.EditableGrid2Ref<TestRow>>(null)

  // チェックボックスの表示方法
  const [showCheckBoxMode, setShowCheckBoxMode] = React.useState<"all" | "function">("all")
  const changeShowCheckBoxMode = (value: typeof showCheckBoxMode) => {
    setShowCheckBoxMode(value)

    // 表示条件が変わることは滅多にないので自動的には再レンダリングされない。
    // 明示的に再レンダリングをかける。
    gridRef.current?.forceUpdate()
  }

  // 行ごとに判定する場合: 出荷済の行にはチェックボックスを表示しない
  const showCheckBox: EG2.EditableGrid2Props<TestRow>["showCheckBox"] = showCheckBoxMode === "all"
    ? true
    : row => row.status !== "出荷済"

  // ref API で取得したチェック行の表示用
  const showCheckedRows = () => {
    const rows = gridRef.current?.getCheckedRows() ?? []
    window.alert(rows.length === 0
      ? "チェックされている行はありません。"
      : `チェックされている行の商品名は、${rows.map(({ row, rowIndex }) => `${row.name}(${rowIndex + 1}行目)`).join("、")}です。`
    )
  }

  // チェックした行の削除
  const removeCheckedRows = () => {
    const rowIndexes = (gridRef.current?.getCheckedRows() ?? []).map(({ rowIndex }) => rowIndex)
    if (rowIndexes.length === 0) {
      window.alert("チェックされている行はありません。")
      return
    }
    remove(rowIndexes)
  }

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [{
    columnId: "no",
    renderHeader: () => <CellText>No.</CellText>,
    renderBody: ({ rowIndex }) => <CellText>{rowIndex + 1}</CellText>,
    defaultWidth: 48,
    disableResizing: true,
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
  }, {
    columnId: "status",
    renderHeader: () => <CellText>状態</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.status`, control })
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
    renderHeader: () => <CellText>数量</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.quantity`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 80,
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="radio"
              name="showCheckBoxMode"
              checked={showCheckBoxMode === "all"}
              onChange={() => changeShowCheckBoxMode("all")}
              className="cursor-pointer"
            />
            すべての行に表示する
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="radio"
              name="showCheckBoxMode"
              checked={showCheckBoxMode === "function"}
              onChange={() => changeShowCheckBoxMode("function")}
              className="cursor-pointer"
            />
            出荷済の行には表示しない
          </label>
        </div>
        <button
          type="button"
          onClick={showCheckedRows}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          チェック中の行を取得する
        </button>
        <button
          type="button"
          onClick={removeCheckedRows}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          チェックした行を削除する
        </button>
        <button
          type="button"
          onClick={() => replace(getDefaultValues())}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          データを元に戻す
        </button>
      </div>

      <EG2.EditableGrid2
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={index => getValues(`rows.${index}`)}
        columns={columns}
        showCheckBox={showCheckBox}
        className="h-80 border border-gray-500 resize-y"
      />
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  name?: string
  status?: "未出荷" | "出荷済"
  quantity?: number
  note?: string
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  const names = ["りんご", "みかん", "ぶどう", "バナナ", "洗剤", "ティッシュ", "歯ブラシ", "乾電池"]

  return Array.from({ length: 20 }).map((_, i) => ({
    rowId: i.toFixed(),
    name: names[i % names.length],
    status: i % 3 === 0 ? "出荷済" : "未出荷",
    quantity: (i * 7) % 20 + 1,
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

const storybookSetting: Meta<typeof RowSelectionExample> = {
  title: "選択/行選択",
  component: RowSelectionExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 行選択: StoryObj<typeof storybookSetting> = {}
