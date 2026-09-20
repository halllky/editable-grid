import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

/** データ1行分のデータ構造 */
type TestRow = {
  name: string
  quantity?: number
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { name: "りんご", quantity: 3 },
    { name: "みかん", quantity: 12 },
    { name: "ぶどう", quantity: 2 },
  ]
}

/**
 * React Hook Form との統合の実演画面。
 */
function ReactHookFormExample() {

  const useFormReturn = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { control, setValue, getValues, subscribe } = useFormReturn
  const { fields, append } = ReactHookForm.useFieldArray({ name: "rows", control })

  // 行のキー。useFieldArray が行ごとに振る id は行が動いても変わらないため、そのまま使える。
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])

  // 行の最新の値。fields には編集後の値が入っていないため、getValues から取得する。
  const getLatestRowObject = React.useCallback((index: number) => getValues(`rows.${index}`), [getValues])

  // React Hook Form の値が変わったことをグリッドに通知する。
  // グリッドの操作による変更も、グリッドの外からの setValue による変更も、どちらも通知される。
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: "rows",
    formState: { values: true },
    callback: onChange,
  }), [subscribe])

  // グリッドの操作（編集確定・貼り付け・Delete）による変更を React Hook Form に反映する。
  // setValue は1回ごとにフォーム全体を複製するため、セル単位ではなく行単位で呼ぶ。
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    for (const { rowIndex, row } of updates) setValue(`rows.${rowIndex}`, row)
  }, [setValue])

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
    // グリッドの値変更を別のコンポーネントでリアルタイムで検知できることを
    // 確認するため FormProvider で値を受け渡しする
    <ReactHookForm.FormProvider {...useFormReturn}>
      <div className="flex flex-wrap gap-2">

        {/* グリッド */}
        <div className="max-w-96 flex flex-col items-start gap-2 p-2">
          <div className="flex gap-2">
            <button type="button"
              onClick={() => append({ name: "", quantity: undefined })}
              className="px-2 py-1 text-sm border border-gray-500 cursor-pointer"
            >
              行を追加する
            </button>
            <button type="button"
              onClick={() => setValue("rows.0.quantity", (getValues("rows.0.quantity") ?? 0) + 1)}
              className="px-2 py-1 text-sm border border-gray-500 cursor-pointer"
            >
              1行目の数量を1つ増やす（※1）
            </button>
          </div>

          <ul className="text-sm mb-2">
            <li>※1 グリッドの外からの setValue が subscribe 経由でセルに反映されることの確認</li>
          </ul>

          <EG2.EditableGrid2
            rowKeys={rowKeys}
            getLatestRowObject={getLatestRowObject}
            subscribe={subscribeRows}
            onRowsChange={handleRowsChange}
            columns={columns}
            className="border border-gray-500"
          />
        </div>

        {/* プレビュー欄 */}
        <div className="flex flex-col w-md">
          <span className="text-sm">
            この欄は (UseFormReturn).watch で最新の値を監視しています。
            グリッドを編集するとその変更が useForm の状態経由でリアルタイムに反映されます。
          </span>
          <WatchPreview />
        </div>
      </div>
    </ReactHookForm.FormProvider>
  )
}

// グリッドの編集がリアルタイムで watch で検出できることの確認用
function WatchPreview() {
  const { watch } = ReactHookForm.useFormContext()
  const currentValues = watch()

  console.log("WatchPreview の再レンダリングが発生しました。")

  return (
    <textarea
      value={JSON.stringify(currentValues, undefined, "  ")}
      readOnly
      className="h-96 resize-none border border-gray-500 outline-none text-xs font-mono"
    ></textarea>
  )
}

// セル編集時に使われるエディタ。
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

/** セルの基本的スタイルを施したもの */
function CellText(props: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof ReactHookFormExample> = {
  title: "その他/react-hook-form との統合",
  component: ReactHookFormExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const ReactHookFormとの統合: StoryObj<typeof storybookSetting> = {}
