import React from "react"
import * as EG2 from "../../EditableGrid2"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<Row>()

/**
 * 列定義がグリッドの外側の state に依存する場合の実演画面。
 */
export function OuterValueExample() {

  // この画面ではデータを変更しないので、state の更新関数は使わない
  const [rows] = React.useState<Row[]>(getDefaultValues)

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  // グリッドの外側の state。金額列のヘッダと表示に使う。
  const [includeTax, setIncludeTax] = React.useState(false)

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
    // includeTax を参照している列。ヘッダも金額も includeTax によって変わる。
    columnId: "amount",
    renderHeader: () => <CellText>{includeTax ? "金額（税込）" : "金額（税抜）"}</CellText>,
    getValuesForRender: row => [calcAmount(row, includeTax)],
    renderBody: ({ deps: [amount] }) => <CellText align="right">{amount.toLocaleString()}</CellText>,
    defaultWidth: 112,
  })],
    // 列定義の中で参照しているグリッドの外側の値をすべて含める
    [includeTax])

  return (
    <div className="flex flex-col gap-2 p-2">
      <label className="self-start flex items-center gap-1 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeTax}
          onChange={e => setIncludeTax(e.target.checked)}
          className="cursor-pointer"
        />
        金額を税込で表示する
      </label>

      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        columns={columns}
        className="border border-gray-500"
      />
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

/** 金額の計算 */
function calcAmount(row: Row, includeTax: boolean): number {
  const amount = row.unitPrice * row.quantity
  return includeTax ? Math.floor(amount * 1.1) : amount
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
