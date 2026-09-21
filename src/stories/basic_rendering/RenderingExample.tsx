import React from "react"
import { EditableGrid, EditableGridColumn, createColumnHelper } from "../../EditableGrid"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = createColumnHelper<Row>()

/**
 * ヘッダ・セル・フッタの描画の実演画面。
 *
 * このページで扱う論点をまとめて示している。
 * - 列定義がグリッドの外側の state（税込表示）に依存する場合
 * - セル内のボタン
 * - フッタ
 */
export function RenderingExample() {

  const [rows, setRows] = React.useState<Row[]>(getDefaultValues)
  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const addQuantity = React.useCallback((rowId: string) => {
    setRows(prev => prev.map(row => row.id === rowId
      ? { ...row, quantity: row.quantity + 1 }
      : row))
  }, [])

  // グリッドの外側の state。金額列のヘッダと表示に使う。
  const [includeTax, setIncludeTax] = React.useState(false)

  // フッタは行の値を受け取らないため、集計に使う最新の行は ref 経由で読む。
  // グリッドへの通知はレンダリングの後に届くため、代入はレンダリング中に行う。
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows

  const columns = React.useMemo((): EditableGridColumn<Row>[] => [col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名</CellText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    // 配列を渡すと上から1段ずつ描画される
    renderFooter: [
      () => <FooterText>合計（※1）</FooterText>,
      () => <FooterText>平均（※1）</FooterText>,
    ],
    defaultWidth: 128,
  }), col.leaf({
    // フッタを指定していない列。足りない段は空のセルになる
    columnId: "unitPrice",
    renderHeader: () => <CellText>単価</CellText>,
    getValuesForRender: row => [row.unitPrice],
    renderBody: ({ deps: [unitPrice] }) => <CellText align="right">{unitPrice.toLocaleString()}</CellText>,
    defaultWidth: 72,
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText align="right">{quantity.toLocaleString()}</CellText>,
    renderFooter: [
      () => <FooterText align="right">{sum(rowsRef.current, row => row.quantity)}</FooterText>,
      () => <FooterText align="right">{average(rowsRef.current, row => row.quantity)}</FooterText>,
    ],
    defaultWidth: 72,
  }), col.leaf({
    // 描画内容が行の値に依存しない列では getValuesForRender を省略できる
    columnId: "addWithStopPropagation",
    renderHeader: () => <CellText>数量+1</CellText>,
    renderBody: ({ rowKey }) => (
      <button
        type="button"
        // セルの選択が動かないよう、mousedown をグリッドに伝えない
        onMouseDown={e => e.stopPropagation()}
        onClick={() => addQuantity(rowKey)}
        className="w-full text-sm text-sky-700 underline cursor-pointer"
      >
        ＋1
      </button>
    ),
    defaultWidth: 104,
  }), col.leaf({
    // includeTax を参照している列。ヘッダも金額も includeTax によって変わる。
    columnId: "amount",
    renderHeader: () => <CellText>{includeTax ? "金額（税込）（※2）" : "金額（税抜）（※2）"}</CellText>,
    getValuesForRender: row => [calcAmount(row, includeTax)],
    renderBody: ({ deps: [amount] }) => <CellText align="right">{amount.toLocaleString()}</CellText>,
    renderFooter: [
      () => <FooterText align="right">{sum(rowsRef.current, row => calcAmount(row, includeTax))}</FooterText>,
      () => <FooterText align="right">{average(rowsRef.current, row => calcAmount(row, includeTax))}</FooterText>,
    ],
    defaultWidth: 160,
  })],
    // 列定義の中で参照している外側の値をすべて含める（rows は rowsRef 経由のため不要）
    [includeTax, addQuantity])

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

      <EditableGrid
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        columns={columns}
        className="border border-gray-500"
      />

      <ul className="text-sm">
        <li>※1：「数量」を更新するとリアルタイムで集計が変わる</li>
        <li>※2：グリッドの外側のチェックボックスに依存する列。ヘッダと金額の両方が切り替わる</li>
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

/** 合計 */
function sum(rows: Row[], pick: (row: Row) => number): string {
  return rows.reduce((acc, row) => acc + pick(row), 0).toLocaleString()
}

/** 平均（小数第1位まで） */
function average(rows: Row[], pick: (row: Row) => number): string {
  if (rows.length === 0) return "0"
  const total = rows.reduce((acc, row) => acc + pick(row), 0)
  return (total / rows.length).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
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

/** フッタの基本的なスタイルを施したもの */
function FooterText({ children, align }: {
  children?: React.ReactNode
  align?: "right"
}) {
  return (
    <span className={`flex-1 px-1 py-px text-sm font-bold text-gray-700 truncate ${align === "right" ? "text-right" : ""}`}>
      {children}
    </span>
  )
}
