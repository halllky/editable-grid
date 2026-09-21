import React from "react"
import * as EG2 from "../../EditableGrid"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<Row>()

/**
 * セル内にボタンを置く場合の実演画面。
 *
 * mousedown の stopPropagation の有無で挙動を見比べられるよう、
 * 同じ処理を行うボタンを2列置いている。
 */
export function CellButtonExample() {

  const [rows, setRows] = React.useState<Row[]>(getDefaultValues)
  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const addQuantity = React.useCallback((rowKey: string) => {
    setRows(prev => prev.map(row => row.id === rowKey
      ? { ...row, quantity: row.quantity + 1 }
      : row))
  }, [])

  const columns = React.useMemo((): EG2.EditableGridColumn<Row>[] => [col.leaf({
    columnId: "name",
    renderHeader: () => <CellText>商品名</CellText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
    defaultWidth: 160,
  }), col.leaf({
    columnId: "quantity",
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: row => [row.quantity],
    renderBody: ({ deps: [quantity] }) => <CellText align="right">{quantity}</CellText>,
    defaultWidth: 64,
  }), col.leaf({
    // 描画内容が行の値に依存しない列では getValuesForRender を省略できる
    columnId: "addWithStopPropagation",
    renderHeader: () => <CellText>数量+1（※1）</CellText>,
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
    columnId: "addWithoutStopPropagation",
    renderHeader: () => <CellText>数量+1（※2）</CellText>,
    renderBody: ({ rowKey }) => (
      <button
        type="button"
        // stopPropagation を呼ばない例。挙動を見比べるために置いているだけなので真似しないこと。
        onClick={() => addQuantity(rowKey)}
        className="w-full text-sm text-sky-700 underline cursor-pointer"
      >
        ＋1
      </button>
    ),
    defaultWidth: 104,
  })], [addQuantity])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        columns={columns}
        className="border border-gray-500"
      />

      <ul className="text-sm">
        <li>※1：mousedown の stopPropagation を呼ぶボタン。押してもセルの選択は動かない。</li>
        <li>※2：呼ばないボタン。押すとそのセルが選択される。</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type Row = {
  id: string
  name: string
  quantity: number
}

/** この画面のデータ */
function getDefaultValues(): Row[] {
  return [
    { id: "1", name: "りんご", quantity: 3 },
    { id: "2", name: "みかん", quantity: 12 },
    { id: "3", name: "ぶどう", quantity: 2 },
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
