import React from "react"
import * as TanStack from "@tanstack/react-table"
import * as TanStackVirtual from "@tanstack/react-virtual"
import { EditableGrid2BodyRenderer, EditableGrid2FooterCellRenderer, EditableGrid2Props, EditableGrid2Ref } from "./types-public"
import { useTanstackColumns } from "./useTanstackColumns"
import { ColumnMetadataInternal, DEFAULT_COLUMN_WIDTH, ESTIMATED_ROW_HEIGHT, GridCell, GridColumn, GridHeader, GridRow, checkIfCellReadOnly, gridFeatures, normalizeFooterRenderers, selectGridState } from "./types-internal"
import { useGetPixel } from "./useGetPixel"
import { SelectedRangeForFixedColumn, SelectedRangeForScrollableColumn } from "./SelectedRange"
import { useSelection } from "./useSelection"
import { useScrollToCell } from "./useScrollToCell"
import { CellEditor, CellEditorRef } from "./CellEditor"
import { useOnKeyDownToStartEditing } from "./useOnKeyDownToStartEditing"
import { useCopyPaste } from "./useCopyPaste"
import { RowAccessor, useRowAccessor, useStableArray } from "./useRowAccessor"
import { useColumnWindow } from "./useColumnWindow"
import { useBatchDispatcher } from "./useBatchDispatcher"
import { DataChangeNotifier, useDataChangeNotifier, useDataChangeSelector } from "./useDataChange"

import "./styles.css"

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
  const getRowObject = useRowAccessor(props.getLatestRowObject, rowKeys)

  const rowDependentPropsRef = React.useRef<RowDependentProps<TRow>>(props)
  rowDependentPropsRef.current = props

  // 行の値が変わったことを表示中のセル・行・フッターへ伝える。
  // 値が変わってもグリッド全体は再描画せず、各セルが getValuesForRender の戻り値を比較して必要なものだけ描画し直す。
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
    columnPinning,
    hasHeaderGroup,
    footerRowCount,
  } = useTanstackColumns(props)

  // TanStack Table のテーブルインスタンスに渡す行データ。
  // 行データではなく行のキー文字列だけを持つ。
  // 値の描画・編集は行の最新状態の取得関数経由で行われるため、テーブル自体は行の値を保持しない。
  // （TanStack は data が変わるたびに全行の行モデルを作り直すため、値の変化のたびに data を差し替える設計にはしない）
  const tableData = React.useMemo(() => rowKeys.map((rowKey): GridRow => ({ rowKey })), [rowKeys])

  // TanStack Table のテーブルインスタンス。
  // 列幅は TanStack 内部に列のID（`col-${columnId}`）をキーに保持される。
  // 列が削除されたときのエントリはあえて残す（同じ columnId の列が後で復活した場合に幅も復元されるため）。
  // 範囲選択も TanStack 内部に行・列のIDで保持される。
  const table = TanStack.useTable({
    features: gridFeatures,
    data: tableData,
    getRowId: row => row.rowKey,
    columns: tanstackColumns,
    columnResizeMode: 'onChange',
    state: {
      columnVisibility,
      columnPinning,
    },
    // チェックボックスを表示していない行はチェックできないようにする
    // （ヘッダの全選択でその行がチェック済みにならないようにするため）
    enableRowSelection: row => props.showCheckBox === true
      || typeof props.showCheckBox === 'function'
      && props.showCheckBox(getRowObject(row.index), row.index),
    // 範囲選択は1つの矩形のみ（ややこしいので Ctrl キーによる複数範囲の選択はしない）
    enableMultiCellRangeSelection: false,
    // data が変わった時に選択範囲をリセットするかどうか
    autoResetCellSelection: false,
    enableColumnResizing: true,
    defaultColumn: {
      size: DEFAULT_COLUMN_WIDTH,
      minSize: 8,
    },
  }, selectGridState)
  const columnSizing = table.state.columnSizing
  const visibleLeafColumns = table.getVisibleLeafColumns()
  const headerGroups = table.getHeaderGroups()
  const totalHeaderHeight = headerGroups.length * ESTIMATED_ROW_HEIGHT
  const totalFooterHeight = footerRowCount * ESTIMATED_ROW_HEIGHT

  // 固定列（行チェックボックス列を含む）。常に左端に並ぶ
  const fixedColumns = table.getStartVisibleLeafColumns()
  const lastFixedIndex = fixedColumns.length === 0 ? null : fixedColumns.length - 1

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

  // 列の仮想化（非固定列のみ）
  const columnWindow = useColumnWindow(
    table,
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
    virtualItems,
    rowVirtualizer,
    totalHeaderHeight,
    columnSizing,
  )

  // 指定セルまでのスクロール
  const scrollToCell = useScrollToCell(
    getPixel,
    visibleLeafColumns,
    table.getStartTotalSize(),
    tableContainerRef,
    totalHeaderHeight,
    totalFooterHeight,
  )

  // 範囲選択
  const {
    getSelectedRange,
    getActiveCell,
    selectionEvents,
    selectRow,
    setSelectionRange,
  } = useSelection(table, props, visibleLeafColumns, scrollToCell)

  // 値の変更の一括反映（編集確定・貼り付け・Delete 共通）
  const batchDispatcher = useBatchDispatcher(visibleLeafColumns, rowKeys, getRowObject, props)

  // エディタ関連
  const editorRef = React.useRef<CellEditorRef>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const onKeyDownToStartEditing = useOnKeyDownToStartEditing()

  // コピー＆ペースト
  const { handleCopy, handlePaste, handleDelete } = useCopyPaste({
    table,
    getSelectedRange,
    onRangeUpdated: setSelectionRange,
    isEditing,
    getRowObject,
    batchDispatcher,
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
      const selectedRange = getSelectedRange()
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
    const activeCell = getActiveCell()
    if (activeCell) {
      const meta = visibleLeafColumns[activeCell.colIndex]?.columnDef.meta
      if (meta?.original?.onCellKeyDown) {
        meta.original.onCellKeyDown({
          row: getRowObject(activeCell.rowIndex),
          rowIndex: activeCell.rowIndex,
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

    const activeCell = getActiveCell()
    if (activeCell && activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex) {
      editorRef.current?.requestEditStart(null)
    }
  }

  //#endregion イベント
  // -----------------------------
  //#region レンダリング

  // 固定列と非固定列のヘッダ。TanStack が固定列の境界でグループ見出しを分割する
  const fixedHeaderGroups = table.getStartHeaderGroups()
  const centerHeaderGroups = table.getCenterHeaderGroups()

  // 画面のスクロール範囲内に表示されている非固定列のフッター
  const footerColumnSlice = columnWindow.sliceLeaves(table.getCenterVisibleLeafColumns())

  // ボディ行の中のセルの描画に影響するグリッドの状態。
  // BodyRow は children（セル）の変化では描画し直さないため、これが変わったときだけ描画し直させる
  // （範囲選択の変更や縦スクロールといった頻繁な再描画では、行とセルの比較を省略する）。
  const rowSelection = table.state.rowSelection
  const cellsTrigger = React.useMemo(() => ({}), [
    columnWindow.key,
    columnSizing,
    visibleLeafColumns,
    lastFixedIndex,
    rowSelection,
    props.columns,
    props.striped,
  ])

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

      {/* source で選択した状態の変更をトリガーとしてこの部分だけ再レンダリングさせる */}
      <table.Subscribe source={table.atoms.cellSelection}>
        {() => {
          const activeCell = getActiveCell()
          return <>
            {/* エディタ */}
            <CellEditor
              ref={editorRef}
              isGridActive={isGridActive}
              activeCell={activeCell}
              scrollContainerScrollLeft={tableContainerRef.current?.scrollLeft ?? 0}
              visibleLeafColumns={visibleLeafColumns}
              onEditingStateChanged={setIsEditing}
              gridEditorComponent={props.editor}
              getPixel={getPixel}
              getRowObject={getRowObject}
              batchDispatcher={batchDispatcher}
            />

            {/* 固定列用の選択範囲レイヤー (tableより手前に置くことで、sticky位置の基準をコンテナ左端にする) */}
            {!isEditing && (
              <SelectedRangeForFixedColumn
                lastFixedIndex={lastFixedIndex}
                getPixel={getPixel}
                anchorCell={activeCell}
                selectedRange={getSelectedRange()}
              />
            )}
          </>
        }}
      </table.Subscribe>

      <table
        className="halllky-eg2-table"
        style={{ minWidth: table.getTotalSize() }}
      >
        {/* 列ヘッダ */}
        <thead className="halllky-eg2-thead">

          {headerGroups.map((headerGroup, headerGroupIndex) => {
            // 画面のスクロール範囲内に表示されている列のみレンダリングされる
            const { spacerWidth, items } = columnWindow.sliceHeaders(centerHeaderGroups[headerGroupIndex]?.headers ?? [])

            // 固定列と非固定列で全く同じ呼び出しが2回出てくるので関数化しておく
            const renderHeader = (header: GridHeader, isFixed: boolean) => (
              <MemorizedTH
                key={header.id}
                header={header}
                headerGroupIndex={headerGroupIndex}
                headerMeta={header.column.columnDef.meta!}
                hasHeaderGroup={hasHeaderGroup}
                isFixed={isFixed}
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
                {fixedHeaderGroups[headerGroupIndex]?.headers.map(header => renderHeader(header, true))}

                {/* 描画範囲外の非固定列 */}
                <ColumnSpacer as="th" width={spacerWidth} />

                {/* 描画範囲内の非固定列 */}
                {items.map(header => renderHeader(header, false))}
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
            const { spacerWidth, items } = columnWindow.sliceLeaves(row.getCenterVisibleCells())

            // 固定列と非固定列で全く同じ呼び出しが2回出てくるので関数化しておく
            const renderCell = (cell: GridCell, isFixed: boolean) => (
              <MemorizedTD
                key={cell.id}
                cell={cell}
                cellMeta={cell.column.columnDef.meta!}
                rowKey={row.id}
                getRowObject={getRowObject}
                rowDependentPropsRef={rowDependentPropsRef}
                dataChange={dataChange}
                isChecked={cell.row.getIsSelected()}
                isFixed={isFixed}
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
                row={row}
                cellsTrigger={cellsTrigger}
              >
                {/* 固定列 */}
                {row.getStartVisibleCells().map(cell => renderCell(cell, true))}

                {/* 描画範囲外の非固定列 */}
                <ColumnSpacer as="td" width={spacerWidth} />

                {/* 描画範囲内の非固定列 */}
                {items.map(cell => renderCell(cell, false))}
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

              // 固定列と非固定列で全く同じ呼び出しが2回出てくるので関数化しておく
              const renderFooterCell = (column: GridColumn, isFixed: boolean) => (
                <MemorizedTF
                  key={column.id}
                  columnMeta={column.columnDef.meta!}
                  footerRowIndex={footerRowIndex}
                  isFixed={isFixed}
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
                  {fixedColumns.map(column => renderFooterCell(column, true))}

                  {/* 描画範囲外の非固定列 */}
                  <ColumnSpacer as="td" width={footerColumnSlice.spacerWidth} />

                  {/* 描画範囲内の非固定列 */}
                  {footerColumnSlice.items.map(column => renderFooterCell(column, false))}
                </tr>
              )
            })}
          </tfoot>
        )}
      </table>

      {/* source で選択した状態の変更をトリガーとしてこの部分だけ再レンダリングさせる */}
      <table.Subscribe source={table.atoms.cellSelection}>
        {() => !isEditing && (
          // スクロール列用の選択範囲レイヤー
          <SelectedRangeForScrollableColumn
            lastFixedIndex={lastFixedIndex}
            getPixel={getPixel}
            anchorCell={getActiveCell()}
            selectedRange={getSelectedRange()}
          />
        )}
      </table.Subscribe>
    </div>
  )

  //#endregion レンダリング
})

export default EditableGrid2 as (<TRow>(props: EditableGrid2Props<TRow> & { ref?: React.ForwardedRef<EditableGrid2Ref<TRow>> }) => React.ReactNode);

/**
 * memo の比較関数を作る。
 * except に指定したプロパティ（レンダリングの度に新しいオブジェクトが渡されるもの）は比較せず、
 * それ以外のプロパティがすべて Object.is で等しい場合に再レンダリングしない。
 */
function arePropsEqualExcept<P extends object>(except: keyof P) {
  return (prev: P, next: P) => {
    for (const key in prev) {
      if (key === except) continue
      if (!Object.is(prev[key], next[key])) return false
    }
    return true
  }
}

//#region メモ化ヘッダ

/**
 * 列ヘッダ
 */
const MemorizedTH = React.memo<{
  header: GridHeader
  headerMeta: ColumnMetadataInternal<any>
  headerGroupIndex: number
  hasHeaderGroup: boolean
  isFixed: boolean
  isResizing: boolean
  size: number
  height: number
  start: number
  /** レンダリングのトリガーにのみ使用 */
  allChecked: unknown
  /** レンダリングのトリガーにのみ使用 */
  columnsTrigger: unknown
}>(function MemorizedTH({ header, headerMeta, hasHeaderGroup, headerGroupIndex, isFixed, isResizing, size, height, start }) {

  // 列グループの有無が混在しているテーブルにおいて、このheaderがグループでない列か否か
  const isNonGroupedUpperHeader = hasHeaderGroup
    && !headerMeta?.isGroupedColumn
    && headerGroupIndex === 0
  const isNonGroupedLowerHeader = hasHeaderGroup
    && !headerMeta?.isGroupedColumn
    && headerGroupIndex === 1

  let className = 'halllky-eg2-th'
  if (isFixed) className += ' halllky-eg2-th--fixed'
  if (isNonGroupedUpperHeader) className += ' halllky-eg2-th--no-bottom-border'

  return (
    <th className={className} style={{
      width: size,
      height,
      left: isFixed ? `${start}px` : undefined,
    }}>
      {isNonGroupedLowerHeader ? (
        // グルーピングが発生するグリッドで、かつこのヘッダがグループ化されない列である場合、
        // プレースホルダ用のレンダリング関数を呼び出す
        headerMeta.original?.renderHeaderPlaceholder?.({ columnWidth: header.getSize() })
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

}, arePropsEqualExcept('header'))

//#endregion メモ化ヘッダ

//#region メモ化ボディ

/**
 * テーブルボディの行。
 * children（セル）はグリッドの描画のたびに新しい要素になるため比較せず、
 * 行の位置・行モデル・セルの描画に影響するグリッドの状態（cellsTrigger）が変わったときだけ描画し直す。
 * 行の値が変わったときは getRowClassName の結果が変わった場合だけ描画し直す（中のセルは描画し直さない）。
 */
const BodyRow = React.memo(function BodyRow({ rowIndex, top, trRef, getRowObject, rowDependentPropsRef, dataChange, children }: {
  rowIndex: number
  top: number
  trRef: React.RefCallback<HTMLTableRowElement>
  getRowObject: RowAccessor<any>
  rowDependentPropsRef: React.RefObject<RowDependentProps<any>>
  dataChange: DataChangeNotifier
  /** レンダリングのトリガーにのみ使用。行モデルが作り直されると変わる */
  row: unknown
  /** レンダリングのトリガーにのみ使用 */
  cellsTrigger: unknown
  children: React.ReactNode
}) {
  const rowClassName = useDataChangeSelector(
    dataChange,
    () => rowDependentPropsRef.current.getRowClassName?.(getRowObject(rowIndex)) ?? '',
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
}, arePropsEqualExcept('children'))

/**
 * テーブルボディセル。
 * 列幅や選択状態などグリッド本体の状態が変わったときは props の変化で描画し直す。
 * 行の値が変わったときは、読み取り専用の判定結果が変わった場合だけこの td ごと描画し直し、
 * それ以外はセルの中身（BodyCellContent）だけが自分の deps を比較して描画し直す。
 * 値の変化で描画し直すコンポーネントを小さくするため、購読を td と中身に分けている。
 */
const MemorizedTD = React.memo<{
  cell: GridCell
  cellMeta: ColumnMetadataInternal<any>
  rowKey: string
  getRowObject: RowAccessor<any>
  rowDependentPropsRef: React.RefObject<RowDependentProps<any>>
  dataChange: DataChangeNotifier
  isFixed: boolean
  isLastFixedColumn: boolean
  size: number
  minHeight: number
  start: number
  propsStriped: boolean | undefined
  /** レンダリングのトリガーにのみ使用 */
  isChecked: unknown
  /** レンダリングのトリガーにのみ使用 */
  columnsTrigger: unknown
}>(function MemorizedTD({ cell, cellMeta, rowKey, getRowObject, rowDependentPropsRef, dataChange, isFixed, size, minHeight, start, propsStriped, isLastFixedColumn }) {

  const rowIndex: number = cell.row.index

  // 行の値に依存する情報をまとめて1回の購読で取得する。
  // 配列の先頭は読み取り専用かどうか、2番目以降はセルのレンダリングに使われる情報。
  // useDataChangeSelector の第2引数の戻り値の変化有無判定の都合上、オブジェクトでなく配列の方がよい。
  const snapshot = useDataChangeSelector(dataChange, () => {
    const row = getRowObject(rowIndex)
    const isReadOnly = checkIfCellReadOnly(cellMeta, rowIndex, rowDependentPropsRef.current.isReadOnly, row)
    return cellMeta.isRowCheckBox
      ? [isReadOnly, cell.row.getCanSelect()]
      : [isReadOnly, ...(cellMeta.original?.getValuesForRender?.(row, rowIndex) ?? [])]
  })
  const isReadOnly = snapshot[0] as boolean

  let className = 'halllky-eg2-td'

  if (!isReadOnly) {
    className += !propsStriped || rowIndex % 2 === 0
      ? ' halllky-eg2-td--bg-default'
      : ' halllky-eg2-td--bg-striped'
  } else if (isFixed) {
    className += ' halllky-eg2-td--bg-readonly'
  }

  if (cellMeta.isRowCheckBox || isLastFixedColumn) {
    className += ' halllky-eg2-td--border-right'
  }

  // z-indexを明示的に指定して SelectedRange(unfixed) より手前に、ヘッダより奥に来るようにする
  if (isFixed) className += ' halllky-eg2-td--fixed'

  return (
    <td
      data-eg2-row-index={rowIndex}
      data-eg2-col-index={cell.column.getIndex()}
      className={className}
      style={{
        width: size,
        minHeight,
        left: isFixed ? `${start}px` : undefined,
      }}
    >
      {cellMeta.isRowCheckBox ? (
        // 行チェックボックス列。グリッド内部で定義した TanStack の列定義で描画する。
        TanStack.flexRender(cell.column.columnDef.cell, cell.getContext())
      ) : (
        <BodyCellContent
          cellMeta={cellMeta}
          snapshot={snapshot}
          rowIndex={rowIndex}
          rowKey={rowKey}
          getRowObject={getRowObject}
          columnWidth={size}
          isReadOnly={isReadOnly}
        />
      )}
    </td>
  )

}, arePropsEqualExcept('cell'))

/**
 * 利用側のボディセルのレンダリング関数をコンポーネントとして描画する。
 *
 * このコンポーネントを挟む理由は、利用側の renderBody に独立したフックの領域を与えるため。
 * renderBody はただの関数として呼び出すので、MemorizedTD の中で直接呼ぶと
 * その中のフックが MemorizedTD 自身のフックと同じ並びに入ってしまう。
 *
 * renderBody を React.createElement で直接包む手もあるが、それだと
 * 利用側の columns の参照が変わるたびにレンダリング関数＝コンポーネント型が変わり、
 * セルの中身が unmount / mount され直してしまうため採用していない。
 */
function BodyCellContent({ cellMeta, snapshot, rowIndex, rowKey, getRowObject, columnWidth, isReadOnly }: {
  cellMeta: ColumnMetadataInternal<any>
  /** MemorizedTD が購読している値。先頭の読み取り専用フラグを除いたものが getValuesForRender の戻り値 */
  snapshot: readonly unknown[]
  rowIndex: number
  rowKey: string
  getRowObject: RowAccessor<any>
  columnWidth: number
  isReadOnly: boolean
}) {
  const deps = snapshot.slice(1)

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
  isFixed: boolean
  size: number
  height: number
  start: number
  dataChange: DataChangeNotifier
  /** レンダリングのトリガーにのみ使用 */
  columnsTrigger: unknown
}>(function MemorizedTF({ columnMeta, footerRowIndex, isFixed, size, height, start, dataChange }) {

  // 通知の回数を購読することで、値が変わるたびに描画し直す
  useDataChangeSelector(dataChange, dataChange.getVersion)

  // original は最新の列定義を返す。行チェックボックス列は null のため常に空セル
  const render = normalizeFooterRenderers(columnMeta.original?.renderFooter)[footerRowIndex]

  let className = 'halllky-eg2-tf'
  if (isFixed) className += ' halllky-eg2-tf--fixed'

  return (
    <td className={className} style={{
      width: size,
      height,
      left: isFixed ? `${start}px` : undefined,
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
