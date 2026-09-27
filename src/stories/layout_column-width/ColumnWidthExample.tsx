import React from "react"
import { EditableGrid, EditableGridColumn, createColumnHelper } from "../../EditableGrid"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = createColumnHelper<Row>()

/**
 * 列幅の実演画面。
 */
export function ColumnWidthExample() {

  // この画面ではデータを変更しないので、state の更新関数は使わない
  const [rows] = React.useState<Row[]>(getDefaultValues)

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const columns = React.useMemo((): EditableGridColumn<Row>[] => [col.leaf({
    // defaultWidth を指定していない列。128px になる（※1）
    columnId: "code",
    renderHeader: () => <HeaderText>コード（※1）</HeaderText>,
    getValuesForRender: row => [row.code],
    renderBody: ({ deps: [code], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{code}</CellText>,
  }), col.leaf({
    columnId: "name",
    renderHeader: () => <HeaderText>商品名（※2）</HeaderText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{name}</CellText>,
    defaultWidth: 240,
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <HeaderText>数量（※3）</HeaderText>,
    getValuesForRender: row => [row.quantity],
    renderBody: ({ deps: [quantity], isReadOnly }) => <CellText isReadOnly={isReadOnly} align="right">{quantity.toLocaleString()}</CellText>,
    defaultWidth: 96,
    disableResizing: true,
  })], [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EditableGrid
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        columns={columns}
        className="border border-gray-500"
      />

      <ul className="text-sm">
        <li>※1：defaultWidth を指定していない列</li>
        <li>※2：defaultWidth に 240 を指定した列</li>
        <li>※3：disableResizing を指定した列。ヘッダの右端をドラッグしても幅が変わらない。</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type Row = {
  id: string
  code: string
  name: string
  quantity: number
}

/** この画面のデータ */
function getDefaultValues(): Row[] {
  return [
    { id: "1", code: "F-001", name: "りんご", quantity: 3 },
    { id: "2", code: "F-002", name: "みかん", quantity: 12 },
    { id: "3", code: "F-003", name: "ぶどう", quantity: 2 },
  ]
}

/** 列ヘッダの基本的なスタイルを施したもの */
function HeaderText({ children }: { children?: React.ReactNode }) {
  return (
    <span className="flex-1 px-1 py-px text-sm truncate">
      {children}
    </span>
  )
}

/** ボディセルの基本的なスタイルを施したもの */
function CellText({ isReadOnly, children, align }: {
  isReadOnly: boolean
  children?: React.ReactNode
  align?: "right"
}) {
  return (
    <span className={`flex-1 px-1 py-px text-sm truncate ${isReadOnly ? "" : "bg-white"} ${align === "right" ? "text-right" : ""}`}>
      {children}
    </span>
  )
}
