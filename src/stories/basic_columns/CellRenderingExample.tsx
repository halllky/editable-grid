import React from "react"
import * as EG2 from "../../EditableGrid2"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<Row>()

/**
 * ヘッダとセルの描画の実演画面。
 *
 * 描画だけが論点なので、この画面のグリッドは編集できない。
 */
export function CellRenderingExample() {

  // この画面ではデータを変更しないので、state の更新関数は使わない
  const [rows] = React.useState<Row[]>(getDefaultValues)

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const columns = React.useMemo((): EG2.EditableGrid2Column<Row>[] => [col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名</CellText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 160,
  }), col.leaf({
    columnId: "unitPrice",
    renderHeader: () => <CellText>単価</CellText>,
    getValuesForRender: row => [row.unitPrice],
    renderBody: ({ deps: [unitPrice] }) => <CellText align="right">{unitPrice.toLocaleString()}</CellText>,
    defaultWidth: 80,
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText align="right">{quantity.toLocaleString()}</CellText>,
    defaultWidth: 80,
  }), col.leaf({
    // 1つのセルの描画に行の複数の値を使う場合、その値をすべて getValuesForRender で返す（※1）
    columnId: "amount",
    renderHeader: () => <CellText>金額（※1）</CellText>,
    getValuesForRender: row => [row.unitPrice, row.quantity],
    renderBody: ({ deps: [unitPrice, quantity] }) => (
      <CellText align="right">{(unitPrice * quantity).toLocaleString()}</CellText>
    ),
    defaultWidth: 96,
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
        <li>※1：単価と数量から計算している列</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type Row = {
  id: string
  name: string
  unitPrice: number
  quantity: number
}

/** この画面のデータ */
function getDefaultValues(): Row[] {
  return [
    { id: "1", name: "りんご", unitPrice: 120, quantity: 3 },
    { id: "2", name: "みかん", unitPrice: 80, quantity: 12 },
    { id: "3", name: "ぶどう", unitPrice: 400, quantity: 2 },
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
