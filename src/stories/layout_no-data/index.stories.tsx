import React from "react"
import { EditableGrid, EditableGridColumn, createColumnHelper } from "../../EditableGrid"
import { Meta, StoryObj } from "@storybook/react-vite"

/** データ1行分のデータ構造 */
type TestRow = {
  id: string
  name: string
  quantity: number
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { id: "1", name: "りんご", quantity: 3 },
    { id: "2", name: "みかん", quantity: 12 },
    { id: "3", name: "ぶどう", quantity: 2 },
  ]
}

/**
 * データが無いときの表示の実演画面
 */
function NoDataExample() {

  const [rows, setRows] = React.useState<TestRow[]>([])
  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const columns = React.useMemo((): EditableGridColumn<TestRow>[] => [
    col.leaf({
      columnId: "name",
      renderHeader: () => <HeaderText>商品名</HeaderText>,
      getValuesForRender: row => [row.name],
      renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    }),
    col.leaf({
      columnId: "quantity",
      renderHeader: () => <HeaderText>数量</HeaderText>,
      getValuesForRender: row => [row.quantity],
      renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
    }),
  ], [])

  return (
    // このデモでは Tailwind CSS を使っているが、必須ではない
    <div className="flex flex-col items-start gap-2 p-2">
      <div className="flex gap-2">
        <button type="button" className="px-2 py-px border border-gray-500 text-sm" onClick={() => setRows(getDefaultValues())}>
          データを追加
        </button>
        <button type="button" className="px-2 py-px border border-gray-500 text-sm" onClick={() => setRows([])}>
          元に戻す
        </button>
      </div>

      {/* 行数に応じて高さが変わるグリッド */}
      <div className="flex gap-4 items-start">
        <div className="flex flex-col gap-1">
          <span className="text-sm">whenNoData 未指定</span>
          <EditableGrid
            rowKeys={rowKeys}
            getLatestRowObject={getLatestRowObject}
            columns={columns}
            className="border border-gray-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm">whenNoData 指定あり</span>
          <EditableGrid
            rowKeys={rowKeys}
            getLatestRowObject={getLatestRowObject}
            columns={columns}
            className="min-h-20 border border-gray-500"

            // 空の場合に表示される
            whenNoData={(
              <span className="block p-4 text-sm text-gray-500 select-none">
                商品が登録されていません
              </span>
            )}
          />
        </div>
      </div>
    </div>
  )
}

const col = createColumnHelper<TestRow>()

function HeaderText(props: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

function CellText(props: { children?: React.ReactNode }) {
  return (
    <span className="flex-1 px-1 py-px bg-white border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

// --------------------------------------------
// 以降はデモ用の設定。グリッドとは無関係

const storybookSetting: Meta<typeof NoDataExample> = {
  title: "レイアウト/データが無いときの表示",
  component: NoDataExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const データが無いときの表示: StoryObj<typeof storybookSetting> = {}
