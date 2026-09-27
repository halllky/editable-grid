import React from "react"
import { EditableGrid, EditableGridColumn, createColumnHelper } from "../../EditableGrid"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = createColumnHelper<Row>()

/**
 * 多段列ヘッダの実演画面。
 */
export function ColumnGroupExample() {

  // この画面ではデータを変更しないので、state の更新関数は使わない
  const [rows] = React.useState<Row[]>(getDefaultValues)

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const columns = React.useMemo((): EditableGridColumn<Row>[] => [col.leaf({
    // グループに属さず、renderHeaderPlaceholder も指定していない列（※1）
    columnId: "code",
    renderHeader: () => <HeaderText>商品コード（※1）</HeaderText>,
    getValuesForRender: row => [row.code],
    renderBody: ({ deps: [code], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{code}</CellText>,
    defaultWidth: 136,
  }), col.leaf({
    columnId: "name",
    renderHeader: () => <HeaderText>商品名（※2）</HeaderText>,
    // 下段に表示する内容。文言はデモのためのもの。
    renderHeaderPlaceholder: () => <HeaderText>ここが下段</HeaderText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{name}</CellText>,
    defaultWidth: 136,
  }), col.group({
    // 単価・数量・金額の3列をまとめるグループ列
    columnId: "price",
    renderHeader: () => <HeaderText>価格</HeaderText>,
    columns: [col.leaf({
      columnId: "unitPrice",
      renderHeader: () => <HeaderText>単価</HeaderText>,
      getValuesForRender: row => [row.unitPrice],
      renderBody: ({ deps: [unitPrice], isReadOnly }) => <CellText isReadOnly={isReadOnly} align="right">{unitPrice.toLocaleString()}</CellText>,
      defaultWidth: 80,
    }), col.leaf({
      columnId: "quantity",
      renderHeader: () => <HeaderText>数量</HeaderText>,
      getValuesForRender: row => [row.quantity],
      renderBody: ({ deps: [quantity], isReadOnly }) => <CellText isReadOnly={isReadOnly} align="right">{quantity.toLocaleString()}</CellText>,
      defaultWidth: 80,
    }), col.leaf({
      columnId: "amount",
      renderHeader: () => <HeaderText>金額</HeaderText>,
      getValuesForRender: row => [row.unitPrice, row.quantity],
      renderBody: ({ deps: [unitPrice, quantity], isReadOnly }) => (
        <CellText isReadOnly={isReadOnly} align="right">{(unitPrice * quantity).toLocaleString()}</CellText>
      ),
      defaultWidth: 96,
    })],
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
        <li>※1：グループに属さない列。下段は空欄になる。</li>
        <li>※2：renderHeaderPlaceholder を指定した列。下段にその内容が表示される。</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type Row = {
  id: string
  code: string
  name: string
  unitPrice: number
  quantity: number
}

/** この画面のデータ */
function getDefaultValues(): Row[] {
  return [
    { id: "1", code: "F-001", name: "りんご", unitPrice: 120, quantity: 3 },
    { id: "2", code: "F-002", name: "みかん", unitPrice: 80, quantity: 12 },
    { id: "3", code: "F-003", name: "ぶどう", unitPrice: 400, quantity: 2 },
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
