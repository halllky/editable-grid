import React from "react"
import { EditableGridCellEditor, EditableGridCellEditorProps, EditableGridCellEditorRef } from "./types-public"
import { GridColumn } from "./types-internal"
import { CellPosition } from "./useSelection"
import { GetPixelFunction } from "./useGetPixel"
import { RowAccessor } from "./useRowAccessor"
import { BatchDispatcher } from "./useBatchDispatcher"

export type CellEditorProps<TRow> = {
  /** グリッド全体がアクティブ状態かどうか */
  isGridActive: boolean
  /** useSelection で管理されているアクティブセル。エディタはこのセルの位置に置かれる */
  activeCell: CellPosition | null
  /** スクロールコンテナのDOM要素のscrollLeft */
  scrollContainerScrollLeft: number
  visibleLeafColumns: GridColumn[]
  /** 編集状態が変わったときに呼ばれるコールバック */
  onEditingStateChanged: (isEditing: boolean) => void
  /** グリッド全体のpropsで指定される標準コンポーネント */
  gridEditorComponent?: EditableGridCellEditor
  /** 座標計算関数 */
  getPixel: GetPixelFunction
  /** 最新の行データを取得する関数 */
  getRowObject: RowAccessor<TRow>
  /** 値の変更の一括反映 */
  batchDispatcher: BatchDispatcher
}

export type CellEditorRef = {
  /**
   * EditableGrid 側でトリガーしてセルエディタに編集開始を要求するために使用
   *
   * @param inputChar クイック編集で最初に入力された文字。nullの場合は通常の編集開始。
   */
  requestEditStart: (inputChar: string | null) => void
}

/**
 * セルの編集を行うコンポーネント。
 * 通常時は透明で表示される。編集モードになると可視化される。
 *
 * キーボードでIME変換が必要な文字が入力された場合、
 * 最初の1文字目がIME変換候補状態で表示されるという動きを実現するため、
 * EditableGrid にフォーカスが当たっているうちは、見えないだけで、必ずこのコンポーネントにフォーカスが当たる。
 */
export const CellEditor = React.forwardRef(function CellEditor<TRow>({
  isGridActive,
  activeCell,
  scrollContainerScrollLeft,
  visibleLeafColumns,
  onEditingStateChanged,
  gridEditorComponent,
  getPixel,
  getRowObject,
  batchDispatcher,
}: CellEditorProps<TRow>, ref: React.ForwardedRef<CellEditorRef>) {

  const editorTextareaRef = React.useRef<EditableGridCellEditorRef>(null)

  const [editorComponent, setEditorComponent] = React.useState<EditableGridCellEditor>(gridEditorComponent ?? NoopEditor)
  const [edittingCell, setEdittingCell] = React.useState<CellPosition | null>(null)

  const isGridActiveRef = React.useRef(isGridActive)
  isGridActiveRef.current = isGridActive

  // -----------------------------------

  /** セルの値をエディタに表示する文字列にする。cellToText が無い列は空文字。 */
  const toEditorText = (cell: CellPosition): string => {
    const columnMeta = visibleLeafColumns[cell.colIndex]?.columnDef.meta
    return columnMeta?.original?.cellToText?.(getRowObject(cell.rowIndex), cell.rowIndex) ?? ''
  }

  // 編集確定
  const commitEditing = (v?: string) => {
    if (edittingCell === null) return;

    const value = v ?? editorTextareaRef.current?.getCurrentValue() ?? ''
    batchDispatcher.dispatch([{
      rowIndex: edittingCell.rowIndex,
      colIndex: edittingCell.colIndex,
      text: value,
    }])

    setEdittingCell(null)
    onEditingStateChanged(false)

    // エディタが select 要素のとき編集確定後にキー操作ができなくなるので setTimeiout を挟む。
    // グリッドの中にフォーカスがある状態でグリッド外のボタンをクリックするなどした場合、
    // setTimeout後の時間ではグリッドからフォーカスが外れてしまっている可能性があるので考慮する。
    window.setTimeout(() => {
      if (!isGridActiveRef.current) return
      editorTextareaRef.current?.setValueAndSelectAll(value, 'edit-end')
    }, 0)
  }
  const commitEditingRef = React.useRef(commitEditing)
  commitEditingRef.current = commitEditing

  // 画面外クリックで編集確定
  React.useEffect(() => {
    if (!edittingCell) return

    const handleMouseDown = (e: MouseEvent) => {
      // エディタ内のクリックなら無視
      const domElement = editorTextareaRef.current?.getDomElement?.()
      if (domElement && e.target instanceof Node && domElement.contains(e.target)) return
      // エディタ外のクリックなら確定
      commitEditingRef.current()
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [edittingCell, commitEditingRef])

  // 編集キャンセル
  const cancelEditing = () => {
    // エディタの値を編集前の値に戻す
    if (edittingCell) {
      const value = toEditorText(edittingCell)
      // エディタが select 要素のとき編集確定後にキー操作ができなくなるので setTimeiout を挟む。
      // グリッドの中にフォーカスがある状態でグリッド外のボタンをクリックするなどした場合、
      // setTimeout後の時間ではグリッドからフォーカスが外れてしまっている可能性があるので考慮する。
      window.setTimeout(() => {
        if (!isGridActiveRef.current) return
        editorTextareaRef.current?.setValueAndSelectAll(value, 'edit-end')
      }, 0)
    }

    setEdittingCell(null)
    onEditingStateChanged(false)
  }

  // エディタの外観
  const editorStyle = React.useMemo((): EditableGridCellEditorProps["style"] => {
    const style: EditableGridCellEditorProps["style"] = {
      position: 'absolute',
      zIndex: 30, // 固定列ヘッダよりも手前
      // クイック編集のためCellEditor自体は常に存在し続けるが、セル編集モードでないときは見えないようにする
      opacity: edittingCell ? undefined : 0,
      pointerEvents: edittingCell ? undefined : 'none',
    }

    if (!activeCell) return style

    // エディタを編集対象セルの位置に移動させる
    const left = getPixel({ position: 'left', colIndex: activeCell.colIndex })
    const right = getPixel({ position: 'right', colIndex: activeCell.colIndex })
    const top = getPixel({ position: 'top', rowIndex: activeCell.rowIndex })
    const bottom = getPixel({ position: 'bottom', rowIndex: activeCell.rowIndex })

    // 固定列の場合、セル本体は position: sticky によってスクロール位置に追従するが、
    // セルエディタは position: absolute で配置しているため、そのままだとスクロール量の分だけ左にずれてしまう。
    // 固定列のときだけ scrollLeft を補正として加算し、見た目上のセル位置と一致させる。
    if (visibleLeafColumns[activeCell.colIndex]?.getIsPinned()) {
      style.left = `${left + scrollContainerScrollLeft}px`
    } else {
      style.left = `${left}px`
    }
    style.top = `${top}px`

    style.width = `${right - left}px`
    style.height = `${bottom - top}px`

    return style
  }, [activeCell, getPixel, edittingCell, visibleLeafColumns, scrollContainerScrollLeft])

  // 移動後のセルの値をエディタにセットする
  React.useEffect(() => {
    if (edittingCell) return
    if (!activeCell) return

    // 移動先の列のエディタコンポーネントに切り替え
    const columnMeta = visibleLeafColumns[activeCell.colIndex]?.columnDef.meta
    let value = ''
    if (columnMeta?.original?.textToCell) {
      value = toEditorText(activeCell)
      setEditorComponent(columnMeta.original.editor ?? gridEditorComponent ?? NoopEditor)
    } else {
      // 編集できない列の場合
      setEditorComponent(NoopEditor)
    }

    // グリッドにフォーカスが当たった瞬間に確実にフォーカスさせるためsetTimeoutを挟む。
    // グリッドの中にフォーカスがある状態でグリッド外のボタンをクリックするなどした場合、
    // setTimeout後の時間ではグリッドからフォーカスが外れてしまっている可能性があるので考慮する。
    window.setTimeout(() => {
      if (!isGridActiveRef.current) return
      editorTextareaRef.current?.setValueAndSelectAll(value, 'move-focus')
    }, 0)
  }, [activeCell, visibleLeafColumns])

  // ref
  React.useImperativeHandle(ref, () => ({
    requestEditStart: inputChar => {
      if (!activeCell) return;

      // エディタコンポーネントが指定されていない場合は編集開始しない
      if (editorComponent === NoopEditor) return;

      // 範囲外のセル、textToCell が無い列、読み取り専用のセルは編集開始しない
      if (!batchDispatcher.isCellWritable(activeCell.rowIndex, activeCell.colIndex)) return;

      // 英数字などIME変換不要な文字が入力されたことによる編集開始の場合、
      // その文字を初期値としてエディタにセットする
      const value = inputChar ?? toEditorText(activeCell)
      editorTextareaRef.current?.setValueAndSelectAll(value, 'edit-start')

      setEdittingCell(activeCell)
      onEditingStateChanged(true)
    },
  }))

  return React.createElement(editorComponent, {
    isEditing: edittingCell !== null,
    requestCommit: commitEditing,
    requestCancel: cancelEditing,
    style: editorStyle,
    ref: editorTextareaRef,
  })
}) as (<TRow>(props: CellEditorProps<TRow> & { ref?: React.ForwardedRef<CellEditorRef> }) => React.ReactNode)


/**
 * エディタコンポーネントが指定されていない場合のデフォルトのエディタ。
 * フォーカスの保持だけを行い、エディタとしての機能は持たない。
 */
const NoopEditor: EditableGridCellEditor = React.forwardRef(function NoopEditor({ style }, ref) {

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useImperativeHandle(ref, () => ({
    blur: () => textareaRef.current?.blur(),
    getCurrentValue: () => textareaRef.current?.value ?? '',
    setValueAndSelectAll: () => textareaRef.current?.select(),
    getDomElement: () => textareaRef.current,
  }), [textareaRef])

  // このコンポーネントは常に非表示
  return (
    <textarea ref={textareaRef} style={style} />
  )
})
