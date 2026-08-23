import type { Meta, StoryObj } from '@storybook/react-vite'
import React from "react"
import { useForm } from "react-hook-form"
import { UUID } from "uuidjs"
import * as EG2 from "../../EditableGrid2"
import { useFieldArrayForEditableGrid2 } from "./useFieldArrayForEditableGrid2"

/**
 * EditableGrid2 を react-hook-form の useFieldArray と組み合わせて使用する例。
 */
function EditableGrid2WithReactHookForm({
  fixed3Cols,
  isLargeData,
  clearSelectionOnBlur,
}: {
  fixed3Cols: boolean
  isLargeData: boolean
  clearSelectionOnBlur: boolean
}) {

  const { control, setValue, getValues } = useForm<{ rows: TestRow[] }>()

  // useFieldArrayForEditableGrid2 フックの使用
  const {
    fieldArrayReturn: { fields, append, insert, remove, replace },
    editableGrid2Props,
    gridRef,
  } = useFieldArrayForEditableGrid2({
    name: "rows", control, getValues, setValue
  }, (helper) => [
    helper.buttonCell(
      row => row.willBeDeleted ? "復元" : "無効化",
      (row, rowIndex) => setValue(`rows.${rowIndex}.willBeDeleted`, !row.willBeDeleted),
      { columnId: "toggleDelete", isFixed: fixed3Cols, disableResizing: true, defaultWidth: 56 }
    ),

    helper.textCell("ID", "rowId", { defaultWidth: 80, isReadOnly: true, isFixed: fixed3Cols }),
    helper.textCell("商品名", "name", { isFixed: fixed3Cols }),
    helper.textCell("価格", "price", { defaultWidth: 120 }),
    helper.selectCell("ステータス", "status", [
      { value: "0", text: "未着手" },
      { value: "1", text: "進行中" },
      { value: "2", text: "完了" },
    ], { defaultWidth: 100 }),
    {
      columnId: "groupedColumns",
      renderHeader: () => <span className="px-1 text-gray-700">グルーピングされた列</span>,
      columns: [
        helper.textCell("日付", "date", { defaultWidth: 140 }),
        helper.booleanCell("フラグ", "bool", { defaultWidth: 80 }),
      ],
    },
    helper.textCell("コメント", "comment", { defaultWidth: 320, wrap: true }),
    helper.textCell("価格(同じ項目を複数回指定する例)", "price", { columnId: "price2", defaultWidth: 252 }),
  ])

  React.useEffect(() => {
    let rows: TestRow[]
    if (isLargeData) {
      rows = Array.from({ length: 1000 }).map((_, i) => ({
        rowId: (i + 1).toString(),
        name: `商品${i + 1}`,
        price: ((i + 1) * 1000).toString(),
        date: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`,
        status: (i % 3).toString(),
        comment: i % 10 === 4 ? `折り返しが発生する長いコメントです。折り返しが発生する長いコメントです。折り返しが発生する長いコメントです。\n\nこのコメントは複数行にわたって表示されます。` : `コメント${i + 1}`,
        bool: i % 2 === 0,
      }))
    } else {
      rows = [
        { rowId: "1", name: "商品A", price: "1000", date: "2024-01-01", comment: "コメントA", bool: true, status: "0" },
        { rowId: "2", name: "商品B", price: "2000", date: "2024-02-01", comment: "コメントB", bool: false, status: "1" },
        { rowId: "3", name: "商品C", price: "3000", date: "2024-03-01", comment: "コメントC", bool: true, status: "2" },
      ]
    }
    replace(rows)
  }, [isLargeData, replace])

  return (
    <div className="flex flex-col items-start">
      <EG2.EditableGrid2
        {...editableGrid2Props}
        showCheckBox
        clearSelectionOnBlur={clearSelectionOnBlur}
        isReadOnly={row => row.willBeDeleted === true}
        className="h-96 self-stretch resize-y border border-gray-300"
      />

      <span className="text-sm font-bold mt-4">
        プログラムから特定の値をセットする例
      </span>
      <div>
        <button type="button" onClick={() => {
          if (fields.length > 0) {
            setValue(`rows.0.comment`, `コメントをプログラムから更新しました: ${new Date().toLocaleString()}`)
            // 外部からの更新後は再描画が必要
            gridRef.current?.forceUpdate()
          }
        }} className="px-2 py-1 text-white bg-blue-600 border border-white cursor-pointer">
          先頭行のコメント列を更新
        </button>
      </div>

      <span className="text-sm font-bold mt-4">
        行追加、削除、入れ替え
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => {
          insert(0, { rowId: UUID.generate(), name: null, price: null, date: null, comment: null, bool: false, status: "0" })
        }} className="px-2 py-1 text-white bg-purple-600 border border-white cursor-pointer">
          先頭に追加
        </button>
        <button type="button" onClick={() => {
          append({ rowId: UUID.generate(), name: null, price: null, date: null, comment: null, bool: false, status: "0" })
        }} className="px-2 py-1 text-white bg-green-600 border border-white cursor-pointer">
          行追加
        </button>
        <button type="button" onClick={() => {
          const checkedRows = gridRef.current?.getCheckedRows() || []
          const removeRowIndexes = checkedRows.map(r => r.rowIndex)
          remove(removeRowIndexes)
        }} className="px-2 py-1 text-white bg-red-600 border border-white cursor-pointer">
          選択した行を削除
        </button>
      </div>
    </div>
  )
}

type TestRow = {
  rowId: string
  name?: string | null
  price?: string | null
  date?: string | null
  comment?: string | null
  bool?: boolean
  willBeDeleted?: boolean
  status?: string
}

/**
 * Storybook におけるこの画面のメタ情報
 */
const meta = {
  title: 'react-hook-form との統合',
  component: EditableGrid2WithReactHookForm,
  tags: ['autodocs'],
  argTypes: {
    fixed3Cols: { control: 'boolean', description: '商品名までの列を固定するかどうか' },
    isLargeData: { control: 'boolean', description: '1000行の大量データを表示するかどうか' },
    clearSelectionOnBlur: { control: 'boolean', description: 'フォーカスアウトで選択を解除するかどうか' },
  },
  args: {
    fixed3Cols: true,
    isLargeData: false,
    clearSelectionOnBlur: true,
  },
} satisfies Meta<typeof EditableGrid2WithReactHookForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LargeData: Story = {
  args: {
    isLargeData: true,
  },
}
