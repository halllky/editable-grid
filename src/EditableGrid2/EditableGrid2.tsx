import React from "react"
import * as TanStack from "@tanstack/react-table"
import * as TanStackVirtual from "@tanstack/react-virtual"
import { EditableGrid2BodyRenderer, EditableGrid2Deps, EditableGrid2FooterCellRenderer, EditableGrid2Props, EditableGrid2Ref } from "./types-public"
import { useTanstackColumns } from "./useTanstackColumns"
import { ColumnMetadataInternal, DEFAULT_COLUMN_WIDTH, ESTIMATED_ROW_HEIGHT, checkIfCellReadOnly, normalizeFooterRenderers } from "./types-internal"
import { useGetPixel } from "./useGetPixel"
import { SelectedRangeForFixedColumn, SelectedRangeForScrollableColumn } from "./SelectedRange"
import { useSelection } from "./useSelection"
import { useScrollToCell } from "./useScrollToCell"
import { CellEditor, CellEditorRef } from "./CellEditor"
import { useOnKeyDownToStartEditing } from "./useOnKeyDownToStartEditing"
import { useCopyPaste } from "./useCopyPaste"
import { RowAccessor, useRowAccessor, useStableArray } from "./useRowAccessor"
import { useColumnWindow } from "./useColumnWindow"
import { useCellWriter } from "./useCellWriter"
import { DataChangeNotifier, useDataChangeNotifier, useDataChangeSelector } from "./useDataChange"

import "./styles.css"

/** getValueForRerender が定義されていない列の deps */
const EMPTY_DEPS: EditableGrid2Deps = []

/**
 * 行の値に依存する判定関数。
 * props の参照が変わっても memo 化されたセル・行を描画し直さずに最新の関数を参照できるよう、ref 経由で渡す。
 */
type RowDependentProps<TRow> = Pick<EditableGrid2Props<TRow>, 'isReadOnly' | 'getRowClassName'>

/**
 * EditableGrid2 コンポーネント
 */
const EditableGrid2 = React.forwardRef(function EditableGrid2<TRow,>(
  props: EditableGrid2Props<TRow>,
  ref: React.ForwardedRef<EditableGrid2Ref<TRow>>
) {

  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const [isGridActive, setIsGridActive] = React.useState(false)
  const rowKeys = useStableArray(props.rowKeys)
  const getRowObject = useRowAccessor(props.getLatestRowObject)

  const rowDependentPropsRef = React.useRef<RowDependentProps<TRow>>(props)
  rowDependentPropsRef.current = props

  // 行の値が変わったことを表示中のセル・行・フッターへ伝える。
  // 値が変わってもグリッド全体は再描画せず、各セルが getValueForRerender の戻り値を比較して必要なものだけ描画し直す。
  const dataChange = useDataChangeNotifier(props.subscribe, [
    props.getLatestRowObject,
    props.isReadOnly,
    props.showCheckBox,
    props.getRowClassName,
    rowKeys,
  ])

  //#region Tanstack table

  // 列定義
  const {
    tanstackColumns,
    columnVisibility,
    hasHeaderGroup,
    lastFixedIndex,
    footerRowCount,
  } = useTanstackColumns(props)

  // TanStack Table のテーブルインスタンス。
  // 行データではなく行のキー文字列だけを持つ。
  // 値の描画・編集は行の最新状態の取得関数経由で行われるため、テーブル自体は行の値を保持しない。
  // （TanStack は data が変わるたびに全行の行モデルを作り直すため、値の変化のたびに data を差し替える設計にはしない）
  //
  // columnSizing は列の columnId（TanStack上のIDは
  // `col-${columnId}` / `group-${columnId}`）をキーに保持される。
  // 列が削除されたときのエントリはあえて残す（同じ columnId の列が後で復活した場合に幅も復元されるため）。
  const [columnSizing, setColumnSizing] = React.useState<TanStack.ColumnSizingState>({})
  const table = TanStack.useReactTable({
    data: rowKeys,
    getRowId: key => key,
    columns: tanstackColumns,
    columnResizeMode: 'onChange',
    onColumnSizingChange: setColumnSizing,
    state: {
      columnSizing,
      columnVisibility,
    },
    getCoreRowModel: TanStack.getCoreRowModel(),
    // チェックボックスを表示していない行はチェックできないようにする
    // （ヘッダの全選択でその行がチェック済みにならないようにするため）
    enableRowSelection: row => props.showCheckBox === true
      || typeof props.showCheckBox === 'function'
      && props.showCheckBox(getRowObject(row.index), row.index),
    enableColumnResizing: true,
    defaultColumn: {
      size: DEFAULT_COLUMN_WIDTH,
      minSize: 8,
      maxSize: 500,
    },
  })
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const headerGroups = table.getHeaderGroups()
  const totalHeaderHeight = headerGroups.length * ESTIMATED_ROW_HEIGHT
  const totalFooterHeight = footerRowCount * ESTIMATED_ROW_HEIGHT

  // 行の仮想化
  const rowModel = table.getRowModel()
  const rowVirtualizer = TanStackVirtual.useVirtualizer({
    count: rowModel.rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    measureElement: element => element?.getBoundingClientRect().height,
    overscan: props.rowOverscan ?? 10,
    // 行が追加・削除・移動されたときに正しく再計算されるようにする
    getItemKey: React.useCallback((index: number) => {
      return rowModel.rows[index].id
    }, [rowModel.rows]),
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const tbodyTrRef = React.useCallback((node: HTMLTableRowElement) => {
    if (node) rowVirtualizer.measureElement(node) // 動的行高さを測定
  }, [rowVirtualizer])

  // 列の仮想化
  const columnWindow = useColumnWindow(
    visibleLeafColumns,
    lastFixedIndex,
    tableContainerRef,
    props.columnOverscan ?? 3,
    columnSizing,
  )

  //#endregion Tanstack table
  // -----------------------------
  //#region 独自機能

  // 座標計算関数
  const getPixel = useGetPixel(
    visibleLeafColumns,
    rowKeys.length,
    virtualItems,
    rowVirtualizer,
    totalHeaderHeight,
    columnSizing,
  )

  // 指定セルまでのスクロール
  const scrollToCell = useScrollToCell(
    getPixel,
    visibleLeafColumns,
    lastFixedIndex,
    tableContainerRef,
    totalHeaderHeight,
    totalFooterHeight,
  )

  // 範囲選択
  const {
    selectedRange,
    anchorCell,
    focusedCell,
    selectionEvents,
    selectRow,
    setSelectionRange,
  } = useSelection(table, props, visibleLeafColumns, scrollToCell)

  // セルへの書き込み（編集確定・貼り付け・Delete 共通）
  const writer = useCellWriter(visibleLeafColumns, rowKeys, getRowObject, props)

  // エディタ関連
  const editorRef = React.useRef<CellEditorRef>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const onKeyDownToStartEditing = useOnKeyDownToStartEditing()

  // コピー＆ペースト
  const { handleCopy, handlePaste, handleDelete } = useCopyPaste({
    table,
    selectedRange,
    onRangeUpdated: setSelectionRange,
    isEditing,
    getRowObject,
    writer,
    props,
  })

  // ref
  React.useImperativeHandle(ref, () => ({
    isEditing,
    getCheckedRows: () => {
      // チェック後に showCheckBox の判定が変わってチェックボックスが非表示になった行は含めない
      return table.getSelectedRowModel().flatRows.filter(r => r.getCanSelect()).map(r => ({
        rowIndex: r.index,
        row: getRowObject(r.index),
      }))
    },
    getSelectedRows: () => {
      if (!selectedRange) return []

      const rows: { rowIndex: number, row: TRow }[] = []
      for (let r = selectedRange.startRow; r <= selectedRange.endRow; r++) {
        const row = getRowObject(r)
        if (row) rows.push({ rowIndex: r, row })
      }
      return rows
    },
    selectRow,
  }))

  //#endregion 独自機能
  // -----------------------------
  //#region イベント

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 編集中はセルエディタの方で処理する
    if (isEditing) return

    // カスタムキーイベントハンドラ (onCellKeyDown)
    if (focusedCell) {
      const col = visibleLeafColumns[focusedCell.colIndex]
      const meta = col.columnDef.meta as ColumnMetadataInternal<TRow>
      if (meta?.original?.onCellKeyDown) {
        meta.original.onCellKeyDown({
          row: getRowObject(focusedCell.rowIndex),
          rowIndex: focusedCell.rowIndex,
          event: e,
          requestEditStart: () => editorRef.current?.requestEditStart(null),
        })
        // イベントハンドラ内で preventDefault された場合はここで処理を終了する
        if (e.defaultPrevented) return
      }
    }

    // 非編集時にDeleteキーが押された場合、選択範囲内の値をクリア
    if (e.key === 'Delete') {
      handleDelete()
      e.preventDefault()
      return
    }

    selectionEvents.handleKeyDown(e)
    onKeyDownToStartEditing(e, inputChar => {
      editorRef.current?.requestEditStart(inputChar)
    })
  }

  const handleFocus = () => {
    if (!isGridActive) {
      setIsGridActive(true)
      selectionEvents.handleGridActiveChanged(true)
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (isGridActive && !e.currentTarget.contains(e.relatedTarget)) {
      setIsGridActive(false)
      selectionEvents.handleGridActiveChanged(false)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditing) return

    const target = e.target as HTMLElement
    // フッター等、ボディセル以外の td は対象外（属性が無いと Number(null) === 0 となり先頭セル扱いになるため）
    const td = target.closest('td[data-eg2-row-index]')
    if (!td) return

    const rowIndex = Number(td.getAttribute('data-eg2-row-index'))
    const colIndex = Number(td.getAttribute('data-eg2-col-index'))
    if (isNaN(rowIndex) || isNaN(colIndex)) return

    if (focusedCell && focusedCell.rowIndex === rowIndex && focusedCell.colIndex === colIndex) {
      editorRef.current?.requestEditStart(null)
    }
  }

  //#endregion イベント
  // -----------------------------
  //#region レンダリング

  return (
    <div
      ref={tableContainerRef}
      className={`halllky-eg2-root ${props.className ?? ""}`}
      tabIndex={0} // 1行も無い場合であってもキーボード操作を受け付けるようにするため

      onKeyDown={handleKeyDown}
      onMouseDown={selectionEvents.handleMouseDown}
      onMouseMove={selectionEvents.handleMouseMove}
      onDoubleClick={handleDoubleClick}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >

      {/* デバッグ用表示 */}
      {/* <div className="sticky left-0 top-0 z-40">
        <div className="absolute top-1 left-1 p-1 bg-white border border-gray-300">
          A: ({anchorCell?.rowIndex}, {anchorCell?.colIndex}),
          F: ({focusedCell?.rowIndex}, {focusedCell?.colIndex})
        </div>
      </div> */}

      {/* エディタ */}
      <CellEditor
        ref={editorRef}
        isGridActive={isGridActive}
        focusedCell={focusedCell}
        scrollContainerScrollLeft={tableContainerRef.current?.scrollLeft ?? 0}
        rowModel={rowModel}
        visibleLeafColumns={visibleLeafColumns}
        onEditingStateChanged={setIsEditing}
        gridEditorComponent={props.editor}
        getPixel={getPixel}
        getRowObject={getRowObject}
        writer={writer}
      />

      {/* 固定列用の選択範囲レイヤー (tableより手前に置くことで、sticky位置の基準をコンテナ左端にする) */}
      {!isEditing && (
        <SelectedRangeForFixedColumn
          lastFixedIndex={lastFixedIndex}
          getPixel={getPixel}
          anchorCell={anchorCell}
          selectedRange={selectedRange}
        />
      )}

      <table
        className="halllky-eg2-table"
        style={{ minWidth: table.getTotalSize() }}
      >
        {/* 列ヘッダ */}
        <thead className="halllky-eg2-thead">

          {headerGroups.map((headerGroup, headerGroupIndex) => {
            // 画面のスクロール範囲内に表示されている列のみレンダリングされる
            const { fixed, spacerWidth, scrollable } = columnWindow.sliceHeaders(headerGroup.headers)

            // 固定列と非固定列で全く同じ呼び出しが2回出てくるので関数化しておく
            const renderHeader = (header: TanStack.Header<string, unknown>) => (
              <MemorizedTH
                key={header.id}
                header={header}
                headerGroupIndex={headerGroupIndex}
                headerMeta={header.column.columnDef.meta as ColumnMetadataInternal<TRow>}
                hasHeaderGroup={hasHeaderGroup}
                isResizing={header.column.getIsResizing()}
                size={header.getSize()}
                height={ESTIMATED_ROW_HEIGHT}
                start={header.getStart()}
                allChecked={table.getIsAllRowsSelected()}
                columnsTrigger={props.columns}
              />
            )
            return (
              <tr key={headerGroup.id} className="halllky-eg2-header-row">
                {/* 固定列 */}
                {fixed.map(renderHeader)}

                {/* 描画範囲外の非固定列 */}
                <ColumnSpacer as="th" width={spacerWidth} />

                {/* 描画範囲内の非固定列 */}
                {scrollable.map(renderHeader)}
              </tr>
            )
          })}
        </thead>

        <tbody className="halllky-eg2-tbody" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>

          {/* 画面のスクロール範囲内に表示されている行のみレンダリングされる */}
          {virtualItems.map(virtualRow => {
            const row = rowModel.rows[virtualRow.index];
            if (!row) return null;

            // 画面のスクロール範囲内に表示されている列のみレンダリングされる
            const { fixed, spacerWidth, scrollable } = columnWindow.sliceLeaves(row.getVisibleCells())

            // 固定列と非固定列で全く同じ呼び出しが2回出てくるので関数化しておく
            const renderCell = (cell: TanStack.Cell<string, unknown>) => (
              <MemorizedTD
                key={cell.id}
                cell={cell}
                cellMeta={cell.column.columnDef.meta as ColumnMetadataInternal<TRow>}
                rowKey={row.id}
                getRowObject={getRowObject}
                rowDependentPropsRef={rowDependentPropsRef}
                dataChange={dataChange}
                isChecked={cell.row.getIsSelected()}
                isLastFixedColumn={cell.column.getIndex() === lastFixedIndex}
                size={cell.column.getSize()}
                minHeight={ESTIMATED_ROW_HEIGHT}
                start={cell.column.getStart()}
                propsStriped={props.striped}
                columnsTrigger={props.columns}
              />
            )

            return (
              <BodyRow
                // virtualRow.key はデータのID、
                // virtualRow.index は表示範囲外も含めたデータ全体内での配列内の位置。
                // key に index を含めない場合、先頭に行挿入などが行われて既存行の index がずれた際に、
                // 画面上で行が増殖して見えたり重なったりする描画崩れが発生する。
                key={`${virtualRow.key}::${virtualRow.index}`}
                rowIndex={virtualRow.index}
                top={virtualRow.start}
                trRef={tbodyTrRef} // 動的行高さを測定
                getRowObject={getRowObject}
                rowDependentPropsRef={rowDependentPropsRef}
                dataChange={dataChange}
              >
                {/* 固定列 */}
                {fixed.map(renderCell)}

                {/* 描画範囲外の非固定列 */}
                <ColumnSpacer as="td" width={spacerWidth} />

                {/* 描画範囲内の非固定列 */}
                {scrollable.map(renderCell)}
              </BodyRow>
            )
          })}

          {/* データが空の場合のメッセージ */}
          {rowModel.rows.length === 0 && (
            <tr className="halllky-eg2-row">
              <td
                colSpan={visibleLeafColumns.length}
                className="halllky-eg2-empty-cell"
              >
                {props.whenNoData ?? "データがありません"}
              </td>
            </tr>
          )}
        </tbody>

        {/* 列フッタ。段が足りない列は空セルになる */}
        {footerRowCount > 0 && (
          <tfoot className="halllky-eg2-tfoot">
            {Array.from({ length: footerRowCount }, (_, footerRowIndex) => {
              // 画面のスクロール範囲内に表示されている列のみレンダリングされる
              const { fixed, spacerWidth, scrollable } = columnWindow.sliceLeaves(visibleLeafColumns)

              // 固定列と非固定列で全く同じ呼び出しが2回出てくるので関数化しておく
              const renderFooterCell = (column: TanStack.Column<string, unknown>) => (
                <MemorizedTF
                  key={column.id}
                  columnMeta={column.columnDef.meta as ColumnMetadataInternal<TRow>}
                  footerRowIndex={footerRowIndex}
                  size={column.getSize()}
                  height={ESTIMATED_ROW_HEIGHT}
                  start={column.getStart()}
                  dataChange={dataChange}
                  columnsTrigger={props.columns}
                />
              )
              return (
                <tr key={footerRowIndex} className="halllky-eg2-footer-row">
                  {/* 固定列 */}
                  {fixed.map(renderFooterCell)}

                  {/* 描画範囲外の非固定列 */}
                  <ColumnSpacer as="td" width={spacerWidth} />

                  {/* 描画範囲内の非固定列 */}
                  {scrollable.map(renderFooterCell)}
                </tr>
              )
            })}
          </tfoot>
        )}
      </table>

      {/* スクロール列用の選択範囲レイヤー */}
      {!isEditing && (
        <SelectedRangeForScrollableColumn
          lastFixedIndex={lastFixedIndex}
          getPixel={getPixel}
          anchorCell={anchorCell}
          selectedRange={selectedRange}
        />
      )}
    </div>
  )

  //#endregion レンダリング
})

export default EditableGrid2 as (<TRow>(props: EditableGrid2Props<TRow> & { ref?: React.ForwardedRef<EditableGrid2Ref<TRow>> }) => React.ReactNode);

//#region メモ化ヘッダ

/**
 * 列ヘッダ
 */
const MemorizedTH = React.memo<{
  header: TanStack.Header<any, any>
  headerMeta: ColumnMetadataInternal<any>
  headerGroupIndex: number
  hasHeaderGroup: boolean
  isResizing: boolean
  size: number
  height: number
  start: number
  /** レンダリングのトリガーにのみ使用 */
  allChecked: unknown
  /** レンダリングのトリガーにのみ使用 */
  columnsTrigger: unknown
}>(function MemorizedTH({ header, headerMeta, hasHeaderGroup, headerGroupIndex, isResizing, size, height, start }) {

  // 列グループの有無が混在しているテーブルにおいて、このheaderがグループでない列か否か
  const isNonGroupedUpperHeader = hasHeaderGroup
    && !headerMeta?.isGroupedColumn
    && headerGroupIndex === 0
  const isNonGroupedLowerHeader = hasHeaderGroup
    && !headerMeta?.isGroupedColumn
    && headerGroupIndex === 1

  let className = 'halllky-eg2-th'
  if (headerMeta.isFixed) className += ' halllky-eg2-th--fixed'
  if (isNonGroupedUpperHeader) className += ' halllky-eg2-th--no-bottom-border'

  return (
    <th className={className} style={{
      width: size,
      height,
      left: headerMeta.isFixed ? `${start}px` : undefined,
    }}>
      {isNonGroupedLowerHeader ? (
        // グルーピングが発生するグリッドで、かつこのヘッダがグループ化されない列である場合、
        // プレースホルダ用のレンダリング関数を呼び出す
        (header.column.columnDef.meta as ColumnMetadataInternal<any>).original?.renderHeaderPlaceholder?.({ columnWidth: header.getSize() })
      ) : (
        // 上記以外は Tanstack Table の通常のヘッダレンダリング
        TanStack.flexRender(header.column.columnDef.header, header.getContext())
      )}

      {/* 列幅を変更できる場合はサイズ変更ハンドラを設定 */}
      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`halllky-eg2-resize-handle ${isResizing ? 'halllky-eg2-resize-handle--resizing' : ''}`}
        />
      )}
    </th>
  )

}, (prev, next) => {
  // 再レンダリングを抑制する条件（trueを返すと再レンダリングしない）。
  // headerはレンダリングの度に新しいオブジェクトが渡されるため比較に使用しない
  const { header: prevHeader, ...prevRest } = prev
  const { header: nextHeader, ...nextRest } = next

  // それ以外
  for (const key in prevRest) {
    const p = prevRest[key as keyof typeof prevRest]
    const n = nextRest[key as keyof typeof nextRest]
    if (!Object.is(p, n)) return false
  }
  return true
})

//#endregion メモ化ヘッダ

//#region メモ化ボディ

/**
 * テーブルボディの行。
 * getRowClassName の結果が変わったときだけ描画し直す（中のセルは描画し直さない）。
 */
function BodyRow({ rowIndex, top, trRef, getRowObject, rowDependentPropsRef, dataChange, children }: {
  rowIndex: number
  top: number
  trRef: React.RefCallback<HTMLTableRowElement>
  getRowObject: RowAccessor<any>
  rowDependentPropsRef: React.RefObject<RowDependentProps<any>>
  dataChange: DataChangeNotifier
  children: React.ReactNode
}) {
  const rowClassName = useDataChangeSelector(
    dataChange,
    () => rowDependentPropsRef.current.getRowClassName?.(getRowObject(rowIndex)) ?? '',
    Object.is,
  )

  return (
    <tr
      data-index={rowIndex} // data-index は TanStack Virtual の予約語
      ref={trRef}
      className={`halllky-eg2-row ${rowClassName}`}
      style={{ top: `${top}px` }}
    >
      {children}
    </tr>
  )
}

/** deps は getValueForRerender が毎回新しい配列を返すため、配列そのものではなく要素ごとに比較する */
function isSameDeps(a: EditableGrid2Deps, b: EditableGrid2Deps): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

/**
 * テーブルボディセル。
 * 列幅や選択状態などグリッド本体の状態が変わったときは props の変化で描画し直す。
 * 行の値が変わったときは、読み取り専用の判定結果が変わった場合だけこの td ごと描画し直し、
 * それ以外はセルの中身（BodyCellContent）だけが自分の deps を比較して描画し直す。
 * 値の変化で描画し直すコンポーネントを小さくするため、購読を td と中身に分けている。
 */
const MemorizedTD = React.memo<{
  cell: TanStack.Cell<any, any>
  cellMeta: ColumnMetadataInternal<any>
  rowKey: string
  getRowObject: RowAccessor<any>
  rowDependentPropsRef: React.RefObject<RowDependentProps<any>>
  dataChange: DataChangeNotifier
  isLastFixedColumn: boolean
  size: number
  minHeight: number
  start: number
  propsStriped: boolean | undefined
  /** レンダリングのトリガーにのみ使用 */
  isChecked: unknown
  /** レンダリングのトリガーにのみ使用 */
  columnsTrigger: unknown
}>(function MemorizedTD({ cell, cellMeta, rowKey, getRowObject, rowDependentPropsRef, dataChange, size, minHeight, start, propsStriped, isLastFixedColumn }) {

  const rowIndex: number = cell.row.index

  // 読み取り専用かどうかは行の値に依存しうる（isReadOnly に関数が指定されている場合）ため、値が変わるたびに判定し直す
  const isReadOnly = useDataChangeSelector(
    dataChange,
    () => checkIfCellReadOnly(cellMeta, rowIndex, rowDependentPropsRef.current.isReadOnly, getRowObject(rowIndex)),
    Object.is,
  )

  let className = 'halllky-eg2-td'

  if (!isReadOnly) {
    className += !propsStriped || rowIndex % 2 === 0
      ? ' halllky-eg2-td--bg-default'
      : ' halllky-eg2-td--bg-striped'
  } else if (cellMeta.isFixed) {
    className += ' halllky-eg2-td--bg-readonly'
  }

  if (cellMeta.isRowCheckBox || isLastFixedColumn) {
    className += ' halllky-eg2-td--border-right'
  }

  // z-indexを明示的に指定して SelectedRange(unfixed) より手前に、ヘッダより奥に来るようにする
  if (cellMeta.isFixed) className += ' halllky-eg2-td--fixed'

  return (
    <td
      data-eg2-row-index={rowIndex}
      data-eg2-col-index={cell.column.getIndex()}
      className={className}
      style={{
        width: size,
        minHeight,
        left: cellMeta.isFixed ? `${start}px` : undefined,
      }}
    >
      {cellMeta.isRowCheckBox ? (
        <RowCheckBoxCellContent cell={cell} dataChange={dataChange} />
      ) : (
        <BodyCellContent
          cellMeta={cellMeta}
          dataChange={dataChange}
          rowIndex={rowIndex}
          rowKey={rowKey}
          getRowObject={getRowObject}
          columnWidth={size}
          isReadOnly={isReadOnly}
        />
      )}
    </td>
  )

}, (prev, next) => {
  // 再レンダリングを抑制する条件（trueを返すと再レンダリングしない）。
  // cell はレンダリングの度に新しいオブジェクトが渡されるため比較に使用しない
  const { cell: prevCell, ...prevRest } = prev
  const { cell: nextCell, ...nextRest } = next

  // それ以外
  for (const key in prevRest) {
    const p = prevRest[key as keyof typeof prevRest]
    const n = nextRest[key as keyof typeof nextRest]
    if (!Object.is(p, n)) return false
  }
  return true
})

/**
 * 利用側のボディセルのレンダリング関数をコンポーネントとして描画する。
 * 値が変わったことの通知を受けるたびに getValueForRerender を呼び直し、戻り値が変わったときだけ描画し直す。
 *
 * レンダリング関数内で呼ばれたフックが MemorizedTD 自身のフックと混ざらないよう td とは分離している。
 * （このコンポーネント自身のフックはレンダリング関数より前に固定の数だけ呼ぶため、順序は崩れない）
 */
function BodyCellContent({ cellMeta, dataChange, rowIndex, rowKey, getRowObject, columnWidth, isReadOnly }: {
  cellMeta: ColumnMetadataInternal<any>
  dataChange: DataChangeNotifier
  rowIndex: number
  rowKey: string
  getRowObject: RowAccessor<any>
  columnWidth: number
  isReadOnly: boolean
}) {
  // original は最新の列定義を返す
  const deps = useDataChangeSelector(
    dataChange,
    () => cellMeta.original?.getValueForRerender?.(getRowObject(rowIndex), rowIndex) ?? EMPTY_DEPS,
    isSameDeps,
  )

  const render: EditableGrid2BodyRenderer<any, any> | undefined = cellMeta.original?.renderBody
  if (!render) return null

  return <>{render({
    deps,
    rowIndex,
    rowKey,
    getRow: () => getRowObject(rowIndex),
    columnWidth,
    isReadOnly,
  })}</>
}

/**
 * 行チェックボックス列のセルの中身。グリッド内部で定義した TanStack の列定義で描画する。
 * showCheckBox の判定結果（行の値に依存しうる）が変わったときに描画し直す。
 */
function RowCheckBoxCellContent({ cell, dataChange }: {
  cell: TanStack.Cell<any, any>
  dataChange: DataChangeNotifier
}) {
  useDataChangeSelector(dataChange, () => cell.row.getCanSelect(), Object.is)
  return <>{TanStack.flexRender(cell.column.columnDef.cell, cell.getContext())}</>
}

//#endregion メモ化ボディ

//#region メモ化フッタ

/**
 * 列フッタセル。
 * 行の値はここから渡さず、 render 内部で直接取得する想定。
 * 行の値が変わったことの通知を受けるたびに描画し直し、スクロールだけでは描画し直さない。
 */
const MemorizedTF = React.memo<{
  columnMeta: ColumnMetadataInternal<any>
  footerRowIndex: number
  size: number
  height: number
  start: number
  dataChange: DataChangeNotifier
  /** レンダリングのトリガーにのみ使用 */
  columnsTrigger: unknown
}>(function MemorizedTF({ columnMeta, footerRowIndex, size, height, start, dataChange }) {

  // 通知の回数を購読することで、値が変わるたびに描画し直す
  useDataChangeSelector(dataChange, dataChange.getVersion, Object.is)

  // original は最新の列定義を返す。行チェックボックス列は null のため常に空セル
  const render = normalizeFooterRenderers(columnMeta.original?.renderFooter)[footerRowIndex]

  let className = 'halllky-eg2-tf'
  if (columnMeta.isFixed) className += ' halllky-eg2-tf--fixed'

  return (
    <td className={className} style={{
      width: size,
      height,
      left: columnMeta.isFixed ? `${start}px` : undefined,
    }}>
      {render && <FooterCellContent render={render} columnWidth={size} />}
    </td>
  )
})

/**
 * 利用側のフッタレンダリング関数をコンポーネントとして描画する。
 * レンダリング関数内で呼ばれたフックが MemorizedTF 自身のフックと混ざらないよう分離している。
 */
function FooterCellContent({ render, columnWidth }: {
  render: EditableGrid2FooterCellRenderer
  columnWidth: number
}) {
  return <>{render({ columnWidth })}</>
}

//#endregion メモ化フッタ

//#region 列の仮想化

/**
 * 列の仮想化で描画を省略した列の幅を埋める要素。
 * data-eg2-row-index を持たないため、クリックしてもセル選択の対象にならない。
 */
function ColumnSpacer({ as: Tag, width }: {
  as: 'th' | 'td'
  width: number
}) {
  if (width <= 0) return null
  return <Tag aria-hidden className="halllky-eg2-spacer" style={{ width }} />
}

//#endregion 列の仮想化
