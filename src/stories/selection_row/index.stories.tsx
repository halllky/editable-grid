import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"
import { createSelectCellEditor } from "../editing_cell-editor/createSelectCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)
const StatusEditor = createSelectCellEditor(["出荷済", "未出荷"] satisfies TestRow["status"][])

// 列定義の型推論の補助（getValueForRerender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

/**
 * 行選択の実演画面。
 *
 * showCheckBox を指定すると、グリッドの左端に行選択用のチェックボックス列が追加される。
 * この画面では、全行にチェックボックスを表示するか、行ごとに表示有無を判定するかを切り替えられる。
 * チェックした行は ref の getCheckedRows() で取得し、取得結果の表示や行削除に使っている。
 */
function RowSelectionExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields, remove, replace } = ReactHookForm.useFieldArray({ name: "rows", control })
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

  // チェックボックスの表示方法
  const [showCheckBoxMode, setShowCheckBoxMode] = React.useState<"all" | "function">("all")

  // 行ごとに判定する場合: 出荷済の行にはチェックボックスを表示しない。
  // 状態を「出荷済」に変更すると、その行のチェックボックスはすぐに消える。
  const showCheckBox = React.useMemo<EG2.EditableGrid2Props<TestRow>["showCheckBox"]>(() => {
    return showCheckBoxMode === "all"
      ? true
      : row => row.status !== "出荷済"
  }, [showCheckBoxMode])

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

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    columnId: "no",
    renderHeader: () => <CellText>No.</CellText>,
    renderBody: ({ rowIndex }) => <CellText>{rowIndex + 1}</CellText>,
    defaultWidth: 48,
    disableResizing: true,
  }), col.leaf({
    columnId: "name",
    editor: TextEditor,
    toText: row => row.name ?? "",
    fromText: (row, text) => ({ ...row, name: text }),
    renderHeader: () => <CellText>商品名</CellText>,
    getValueForRerender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 128,
  }), col.leaf({
    columnId: "status",
    editor: StatusEditor,
    toText: row => String(row.status ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, status: undefined }
      return (["未出荷", "出荷済"] as const).includes(text as NonNullable<TestRow["status"]>)
        ? { ...row, status: text as NonNullable<TestRow["status"]> }
        : undefined
    },
    renderHeader: () => <CellText>状態</CellText>,
    getValueForRerender: row => [row.status],
    renderBody: ({ deps: [status] }) => <CellText>{status}</CellText>,
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
    renderHeader: () => <CellText>数量</CellText>,
    getValueForRerender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
    defaultWidth: 80,
  }), col.leaf({
    columnId: "note",
    editor: TextEditor,
    toText: row => row.note ?? "",
    fromText: (row, text) => ({ ...row, note: text }),
    renderHeader: () => <CellText>備考</CellText>,
    getValueForRerender: row => [row.note],
    renderBody: ({ deps: [note] }) => <CellText>{note}</CellText>,
    defaultWidth: 240,
  })], [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="radio"
              name="showCheckBoxMode"
              checked={showCheckBoxMode === "all"}
              onChange={() => setShowCheckBoxMode("all")}
              className="cursor-pointer"
            />
            すべての行に表示する
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="radio"
              name="showCheckBoxMode"
              checked={showCheckBoxMode === "function"}
              onChange={() => setShowCheckBoxMode("function")}
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
        getLatestRowObject={getLatestRowObject}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}
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
