import React from "react"
import * as EG2 from "../../EditableGrid2"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<Row>()

/**
 * 列幅の実演画面。
 */
export function ColumnWidthExample() {

  // この画面ではデータを変更しないので、state の更新関数は使わない
  const [rows] = React.useState<Row[]>(getDefaultValues)

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const columns = React.useMemo((): EG2.EditableGrid2Column<Row>[] => [col.leaf({
    // defaultWidth を指定していない列。128px になる（※1）
    columnId: "code",
    renderHeader: () => <CellText>コード（※1）</CellText>,
    getValuesForRender: row => [row.code],
    renderBody: ({ deps: [code] }) => <CellText>{code}</CellText>,
  }), col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名（※2）</CellText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 240,
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <CellText>数量（※3）</CellText>,
    getValuesForRender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText align="right">{quantity.toLocaleString()}</CellText>,
    defaultWidth: 96,
    disableResizing: true,
  })], [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid2
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

/** セルの基本的なスタイルを施したもの */
function CellText({ children, align }: {
  children?: React.ReactNode
  align?: "right"
}) {
  return (
    <span className={`flex-1 px-1 py-px text-sm truncate ${align === "right" ? "text-right" : ""}`}>
      {children}
    </span>
  )
}
