import React from "react"
import { EditableGrid, EditableGridColumn, EditableGridLeafColumn, EditableGridRef, EditableGridRowUpdate, createColumnHelper } from "../../EditableGrid"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

/** データ1行分 */
type TestRow = {
  id: string
  name: string
  quantity?: number
  note?: string
}

/**
 * 行の追加・削除・並べ替えをボタンで行う実演画面。
 * 操作の対象になる行は ref の getSelectedRows() で決める。
 */
function ButtonExample() {

  const gridRef = React.useRef<EditableGridRef<TestRow>>(null)
  const { rowKeys, getLatestRowObject, handleRowsChange, addRow, removeSelectedRows, moveSelectedRows } = useRowOperations(gridRef)
  const columns = useColumns()

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex gap-1">
        <button type="button" onClick={addRow} className="px-2 border border-gray-500 bg-white cursor-pointer">
          行を追加
        </button>
        <button type="button" onClick={removeSelectedRows} className="px-2 border border-gray-500 bg-white cursor-pointer">
          選択行を削除
        </button>
        <button type="button" onClick={() => moveSelectedRows(-1)} className="px-2 border border-gray-500 bg-white cursor-pointer">
          上へ
        </button>
        <button type="button" onClick={() => moveSelectedRows(1)} className="px-2 border border-gray-500 bg-white cursor-pointer">
          下へ
        </button>
      </div>

      <EditableGrid
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500 resize-y"
      />
    </div>
  )
}

/**
 * 行の追加・削除・並べ替えをキーボードで行う実演画面。
 * 行の操作自体はボタンのデモと同じで、きっかけが列定義の onCellKeyDown になっただけ。
 */
function KeyboardExample() {

  const gridRef = React.useRef<EditableGridRef<TestRow>>(null)
  const { rowKeys, getLatestRowObject, handleRowsChange, addRow, removeSelectedRows, moveSelectedRows } = useRowOperations(gridRef)

  const handleCellKeyDown = React.useCallback<NonNullable<EditableGridLeafColumn<TestRow>["onCellKeyDown"]>>(({ event }) => {
    const ctrl = event.ctrlKey || event.metaKey

    if (ctrl && event.key === "Enter") {
      addRow()
      event.preventDefault()

    } else if (ctrl && event.key === "Delete") {
      removeSelectedRows()
      event.preventDefault() // 呼ばないと、削除に加えてセルのクリアも実行される

    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      moveSelectedRows(event.key === "ArrowUp" ? -1 : 1)
      event.preventDefault()
    }
  }, [addRow, removeSelectedRows, moveSelectedRows])

  const columns = useColumns(handleCellKeyDown)

  return (
    <div className="flex flex-col gap-2 p-2">
      <span className="text-sm">
        Ctrl + Enter で行を追加、Ctrl + Delete で選択行を削除、Alt + ↑ / Alt + ↓ で選択行を移動します。
      </span>

      <EditableGrid
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500 resize-y"
      />
    </div>
  )
}

/**
 * 行の追加・削除・並べ替えの実装。このページの2つのデモで共有している。
 * グリッドは操作の対象になる行を答えるだけで、行の増減・並べ替えは行データの持ち主の側で行う。
 */
function useRowOperations(gridRef: React.RefObject<EditableGridRef<TestRow> | null>) {

  // 大元のデータ配列
  const [rows, setRows] = React.useState<TestRow[]>(getDefaultValues)

  // 行のキー。行が動いても変わらない値を使う
  const rowKeys = React.useMemo(() => rows.map(row => row.id), [rows])
  const getLatestRowObject = React.useCallback((index: number) => rows[index], [rows])

  // 行を操作する関数から最新の行データを参照するための ref。
  // これらの関数が rows に依存すると、セルを編集するたびに関数の参照が変わり、
  // その関数を使っている列定義も作り直されてしまう
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows

  const handleRowsChange = React.useCallback((updates: EditableGridRowUpdate<TestRow>[]) => {
    setRows(prev => {
      const next = [...prev]
      for (const { rowIndex, row } of updates) next[rowIndex] = row
      return next
    })
  }, [])

  // 追加した行に割り当てるキーの採番。既存の行のキーと重複しない値であればよい
  const sequenceRef = React.useRef(0)

  // 追加・削除した位置の行を選択し直すための予約。
  // rowKeys が新しくなった後でないと選択できないため、選択は useEffect で行う
  const [rowIndexToSelect, setRowIndexToSelect] = React.useState<number>()
  React.useEffect(() => {
    if (rowIndexToSelect === undefined) return
    gridRef.current?.selectRow(rowIndexToSelect, rowIndexToSelect)
    setRowIndexToSelect(undefined)
  }, [rowIndexToSelect, rows, gridRef])

  /** 選択範囲の下に1行追加する。未選択の場合は末尾に追加する */
  const addRow = React.useCallback(() => {
    const selectedRows = gridRef.current?.getSelectedRows() ?? []
    const insertAt = selectedRows.length === 0
      ? rowsRef.current.length
      : selectedRows[selectedRows.length - 1].rowIndex + 1

    const newRow: TestRow = { id: `new-${++sequenceRef.current}`, name: "" }
    setRows(prev => [...prev.slice(0, insertAt), newRow, ...prev.slice(insertAt)])
    setRowIndexToSelect(insertAt)
  }, [gridRef])

  /** 選択範囲の行を削除する */
  const removeSelectedRows = React.useCallback(() => {
    const selectedRows = gridRef.current?.getSelectedRows() ?? []
    if (selectedRows.length === 0) return

    const removedRowIndexes = new Set(selectedRows.map(({ rowIndex }) => rowIndex))
    setRows(prev => prev.filter((_, rowIndex) => !removedRowIndexes.has(rowIndex)))

    // 削除された行は選択できないため、その位置に繰り上がってきた行を選択する
    setRowIndexToSelect(selectedRows[0].rowIndex)
  }, [gridRef])

  /** 選択範囲の行を1行分だけ上または下へ動かす */
  const moveSelectedRows = React.useCallback((offset: -1 | 1) => {
    const selectedRows = gridRef.current?.getSelectedRows() ?? []
    if (selectedRows.length === 0) return

    const start = selectedRows[0].rowIndex
    const count = selectedRows.length
    setRows(prev => {
      // 端の行はそれ以上動かせない
      if (start + offset < 0 || start + count - 1 + offset > prev.length - 1) return prev

      // 行オブジェクトはそのまま動かす。キーが変わらないため、選択やチェックも行に付いて動く
      const next = [...prev]
      const movedRows = next.splice(start, count)
      next.splice(start + offset, 0, ...movedRows)
      return next
    })
  }, [gridRef])

  return { rowKeys, getLatestRowObject, handleRowsChange, addRow, removeSelectedRows, moveSelectedRows }
}

/**
 * 列定義。このページの2つのデモで共有している。
 * キー操作は列ごとに指定するため、引数のハンドラを全列に渡している。
 */
function useColumns(onCellKeyDown?: EditableGridLeafColumn<TestRow>["onCellKeyDown"]) {
  return React.useMemo((): EditableGridColumn<TestRow>[] => [
    col.leaf({
      columnId: "id",
      isReadOnly: true,
      renderHeader: () => <CellText>行のキー</CellText>,
      getValuesForRender: row => [row.id],
      renderBody: ({ deps: [id] }) => <CellText>{id}</CellText>,
      defaultWidth: 136,
      onCellKeyDown,
    }),
    col.leaf({
      columnId: "name",
      renderHeader: () => <CellText>商品名</CellText>,
      getValuesForRender: row => [row.name],
      renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
      editor: TextEditor,
      cellToText: row => row.name,
      textToCell: (row, text) => ({ ...row, name: text }),
      defaultWidth: 128,
      onCellKeyDown,
    }),
    col.leaf({
      columnId: "quantity",
      renderHeader: () => <CellText>数量</CellText>,
      getValuesForRender: row => [row.quantity],
      renderBody: ({ deps: [quantity] }) => <CellText>{quantity}</CellText>,
      editor: TextEditor,
      cellToText: row => String(row.quantity ?? ""),
      textToCell: (row, text) => {
        if (text.trim() === "") return { ...row, quantity: undefined }
        const parsed = Number(text)
        return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
      },
      defaultWidth: 72,
      onCellKeyDown,
    }),
    col.leaf({
      columnId: "note",
      renderHeader: () => <CellText>備考</CellText>,
      getValuesForRender: row => [row.note],
      renderBody: ({ deps: [note] }) => <CellText>{note}</CellText>,
      editor: TextEditor,
      cellToText: row => row.note ?? "",
      textToCell: (row, text) => ({ ...row, note: text }),
      defaultWidth: 160,
      onCellKeyDown,
    }),
  ], [onCellKeyDown])
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { id: "1", name: "りんご", quantity: 3, note: "" },
    { id: "2", name: "みかん", quantity: 12, note: "箱買い" },
    { id: "3", name: "ぶどう", quantity: 2, note: "" },
    { id: "4", name: "洗剤", quantity: 1, note: "" },
    { id: "5", name: "ティッシュ", quantity: 20, note: "" },
  ]
}

// セル編集時に使われるエディタ。セルエディタのページを参照
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助
const col = createColumnHelper<TestRow>()

/** セルの基本的スタイルを施したもの */
function CellText(props: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px border border-transparent text-sm truncate">
      {props.children}
    </span>
  )
}

// --------------------------------------------
// 以降はデモ用の設定。グリッドとは無関係

const storybookSetting: Meta = {
  title: "編集/行の追加・削除・並べ替え",
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const ボタンで操作する: StoryObj = { render: () => <ButtonExample /> }
export const キーボードで操作する: StoryObj = { render: () => <KeyboardExample /> }
