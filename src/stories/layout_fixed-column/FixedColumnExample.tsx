import React from "react"
import { EditableGrid, EditableGridColumn, createColumnHelper } from "../../EditableGrid"

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = createColumnHelper<Row>()

/**
 * 列固定の実演画面。
 *
 * 横スクロールが起きるよう、列数と列幅を多めにとっている。
 */
export function FixedColumnExample() {

  // この画面ではデータを変更しないので、state の更新関数は使わない
  const [rows] = React.useState<Row[]>(getDefaultValues)

  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  const columns = React.useMemo((): EditableGridColumn<Row>[] => [col.leaf({
    // isFixed を指定していないが、右隣の商品名列が固定のため固定される（※1）
    columnId: "code",
    renderHeader: () => <HeaderText>商品コード（※1）</HeaderText>,
    getValuesForRender: row => [row.code],
    renderBody: ({ deps: [code], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{code}</CellText>,
    defaultWidth: 136,
  }), col.leaf({
    columnId: "name",
    renderHeader: () => <HeaderText>商品名（※2）</HeaderText>,
    getValuesForRender: row => [row.name],
    renderBody: ({ deps: [name], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{name}</CellText>,
    defaultWidth: 136,
    isFixed: true,
  }), col.leaf({
    columnId: "supplier",
    renderHeader: () => <HeaderText>仕入先</HeaderText>,
    getValuesForRender: row => [row.supplier],
    renderBody: ({ deps: [supplier], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{supplier}</CellText>,
    defaultWidth: 240,
  }), col.leaf({
    columnId: "location",
    renderHeader: () => <HeaderText>保管場所</HeaderText>,
    getValuesForRender: row => [row.location],
    renderBody: ({ deps: [location], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{location}</CellText>,
    defaultWidth: 240,
  }), col.leaf({
    columnId: "note",
    renderHeader: () => <HeaderText>備考</HeaderText>,
    getValuesForRender: row => [row.note],
    renderBody: ({ deps: [note], isReadOnly }) => <CellText isReadOnly={isReadOnly}>{note}</CellText>,
    defaultWidth: 480,
  })], [])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EditableGrid
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        columns={columns}
        showCheckBox // 行選択のチェックボックス列（※3）
        className="border border-gray-500"
      />

      <ul className="text-sm">
        <li>※1：isFixed を指定していないが、右隣の商品名列が固定のため固定される</li>
        <li>※2：isFixed を指定した列</li>
        <li>※3：isFixed の指定に関わらず固定されるチェックボックス列</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type Row = {
  id: string
  code: string
  name: string
  supplier: string
  location: string
  note: string
}

/** この画面のデータ */
function getDefaultValues(): Row[] {
  return [
    { id: "1", code: "F-001", name: "りんご", supplier: "青果卸センター", location: "第1倉庫 冷蔵A-12", note: "" },
    { id: "2", code: "F-002", name: "みかん", supplier: "青果卸センター", location: "第1倉庫 冷蔵A-14", note: "箱買い" },
    { id: "3", code: "F-003", name: "ぶどう", supplier: "山田フルーツ", location: "第1倉庫 冷蔵B-03", note: "" },
    { id: "4", code: "D-001", name: "洗剤", supplier: "日用品商事", location: "第2倉庫 常温C-21", note: "" },
    { id: "5", code: "D-002", name: "ティッシュ", supplier: "日用品商事", location: "第2倉庫 常温C-22", note: "" },
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
function CellText({ isReadOnly, children }: { isReadOnly: boolean, children?: React.ReactNode }) {
  return (
    <span className={`flex-1 px-1 py-px text-sm truncate ${isReadOnly ? "" : "bg-white"}`}>
      {children}
    </span>
  )
}
