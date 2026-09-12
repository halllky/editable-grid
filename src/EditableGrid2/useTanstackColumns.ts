import React from "react"
import * as TanStack from "@tanstack/react-table"
import { EditableGrid2GroupColumn, EditableGrid2LeafColumn, EditableGrid2Props } from "./types-public"
import { createRowCheckBoxColumn } from "./RowCheckBox"
import { checkIfCellReadOnly, ColumnMetadataInternal, DEFAULT_COLUMN_WIDTH } from "./types-internal"
import { RowAccessor } from "./useRowAccessor"

/**
 * EditableGrid2 の列定義を TanStack Table の列定義に変換するカスタムフック
 */
export function useTanstackColumns<TRow>(
  props: EditableGrid2Props<TRow>,
  getRowObject: RowAccessor<TRow>
) {

  // 列定義から導出する値。
  // props.columns の参照が変わったときだけ計算し直し、グリッド内部の state 変化や
  // スクロールによる再レンダリングでは再計算しない。
  const {
    flatten,
    leafByColumnId,
    groupByColumnId,
    columnsSignature,
  } = React.useMemo(() => {

    // 処理しやすいようにグループ列を展開
    const flatten: FlattenedColumn<TRow>[] = props.columns.flatMap(colDef => {
      if ('columns' in colDef) {
        return colDef.columns.map(leaf => ({ group: colDef, leaf }))
      } else {
        return [{ leaf: colDef }]
      }
    })

    // columnId の重複検証。TanStack は列IDが重複していても無言で壊れるため、ここで早期に検出する。
    const leafIds = new Set<string>()
    for (const { leaf } of flatten) {
      if (leafIds.has(leaf.columnId)) {
        throw new Error(`EditableGrid2: 列定義の columnId が重複しています: "${leaf.columnId}"`)
      }
      leafIds.add(leaf.columnId)
    }
    const groupIds = new Set<string>()
    for (const colDef of props.columns) {
      if ('columns' in colDef) {
        if (groupIds.has(colDef.columnId)) {
          throw new Error(`EditableGrid2: グループ列定義の columnId が重複しています: "${colDef.columnId}"`)
        }
        groupIds.add(colDef.columnId)
      }
    }

    // cell / header レンダリング関数から columnId で最新の列定義を引くための Map
    const leafByColumnId = new Map(flatten.map(({ leaf }) => [leaf.columnId, leaf]))
    const groupByColumnId = new Map(
      flatten.flatMap(({ group }) => group ? [[group.columnId, group] as const] : [])
    )

    // 列の構造シグネチャ（後述の signature を参照）
    const columnsSignature = flatten.map(({ group, leaf }) => [
      group?.columnId ?? '',
      leaf.columnId,
      leaf.defaultWidth ?? '',
      leaf.disableResizing === true ? '1' : '0',
      leaf.invisible === true ? '1' : '0',
      leaf.isFixed === true ? '1' : '0',
    ].join('\u0000')).join('\u0000')

    return { flatten, leafByColumnId, groupByColumnId, columnsSignature }
  }, [props.columns])

  // cell / header レンダリング関数が毎回最新の列定義を引けるように ref を更新する
  const latestRef = React.useRef<LatestColumnsState<TRow>>(null as unknown as LatestColumnsState<TRow>)
  latestRef.current = {
    leafByColumnId,
    groupByColumnId,
    gridIsReadOnly: props.isReadOnly,
    showCheckBox: props.showCheckBox,
  }

  // TanStack に渡す列定義の再構築要否を判定するための構造シグネチャ。
  // props.columns の参照は依存配列の値が変わるたびに変わるが、そのたびに TanStack の列定義を作り直すと
  // cell 関数が新しくなり、React 上は別コンポーネント扱いとなって表示中の全セルが再マウントされてしまう。
  // そのため、参照ではなく構造が変わったときだけ作り直す。
  // ここに含めるのは、TanStack の列定義（size, enableResizing, meta.isFixed 等）に含まれ、
  // ref 経由の live view では差し替えられない項目のみ。
  // showCheckBox は関数を取りうるため、値そのものではなく「指定の有無」だけを含める
  // （実際の判定は cell 側で毎回 latestRef から解決する）。
  const showCheckBoxSpecified = props.showCheckBox === true || typeof props.showCheckBox === 'function'
  const signature = (showCheckBoxSpecified ? '1' : '0') + '\u0000' + columnsSignature

  return React.useMemo(() => {

    // 左列から順に true, false, true のように指定された場合、
    // 最後の true より左側はすべて固定列とする。
    // 不可視列を挟んでも固定列の境界がずれないよう、可視リーフのみを対象に算出する。
    const visibleFlatten = flatten.filter(item => item.leaf.invisible !== true)
    const maxIndexOfIsFixed = visibleFlatten.reduce((max, cur, idx) => {
      return cur.leaf.isFixed === true ? idx : max
    }, -1)

    // グループ化されない列を TanStack Table の列定義に変換
    // (行データではなく行キー文字列をテーブルの行として扱うため、TRow ではなく string を型引数に使う)
    const columnHelper = TanStack.createColumnHelper<string>()
    let visibleLeafIndex = -1
    const withTanstackLeafColumn = flatten.map(({ group, leaf }) => {
      const isVisible = leaf.invisible !== true
      if (isVisible) visibleLeafIndex++

      const leafColumnId = leaf.columnId
      const meta: ColumnMetadataInternal<TRow> = {
        columnId: leafColumnId,
        leafIndex: isVisible ? visibleLeafIndex : null,
        isFixed: isVisible && visibleLeafIndex <= maxIndexOfIsFixed,
        isGroupedColumn: group !== undefined,
        isRowCheckBox: false,
        // 呼び出し側の columns が再評価されるたびに最新の内容を返す
        get original() {
          return latestRef.current.leafByColumnId.get(leafColumnId) ?? null
        },
        get isReadOnly() {
          return latestRef.current.leafByColumnId.get(leafColumnId)?.isReadOnly ?? false
        },
      }

      return {
        group,
        leaf,
        tanstackLeafColumn: columnHelper.display({
          id: `col-${leafColumnId}`,
          header: context => latestRef.current.leafByColumnId.get(leafColumnId)?.renderHeader({
            columnWidth: context.header.getSize(),
          }),
          cell: context => {
            const currentLeaf = latestRef.current.leafByColumnId.get(leafColumnId)
            if (!currentLeaf) return null
            const row = getRowObject(context.row.index)
            return currentLeaf.renderBody({
              row,
              rowIndex: context.row.index,
              columnWidth: context.column.getSize(),
              isReadOnly: checkIfCellReadOnly(meta, context.row.index, latestRef.current.gridIsReadOnly, row),
            })
          },
          size: leaf.defaultWidth ?? DEFAULT_COLUMN_WIDTH,
          enableResizing: leaf.disableResizing !== true,
          meta,
        }),
      }
    })

    // 最終的な TanStack Table の列定義を構築
    const tanstackColumns: TanStack.ColumnDef<string>[] = []
    if (showCheckBoxSpecified) {
      tanstackColumns.push(createRowCheckBoxColumn(
        () => latestRef.current.showCheckBox,
        columnHelper,
        getRowObject
      ))
    }
    let currentGroupColumnId: string | undefined = undefined
    for (const item of withTanstackLeafColumn) {
      if (item.group === undefined) {
        // グループ化されない列
        tanstackColumns.push(item.tanstackLeafColumn)

      } else if (item.group.columnId === currentGroupColumnId) {
        // グループ化された列（1つ前のグループと同じ）
        const gp = tanstackColumns[tanstackColumns.length - 1] as TanStack.GroupColumnDef<string>
        gp.columns!.push(item.tanstackLeafColumn)

      } else {
        // グループ化された列（新しいグループ）
        const groupColumnId = item.group.columnId
        tanstackColumns.push(columnHelper.group({
          id: `group-${groupColumnId}`,
          header: context => latestRef.current.groupByColumnId.get(groupColumnId)?.renderHeader({
            columnWidth: context.header.getSize(),
          }),
          columns: [item.tanstackLeafColumn],
          meta: {
            columnId: groupColumnId,
            leafIndex: null,
            original: null,
            isFixed: false,
            isReadOnly: false,
            isGroupedColumn: true,
            isRowCheckBox: false,
          } satisfies ColumnMetadataInternal<TRow>,
        }))
      }
      currentGroupColumnId = item.group?.columnId
    }

    const hasHeaderGroup = withTanstackLeafColumn
      .some(item => item.group !== undefined)

    const columnVisibility: TanStack.VisibilityState = Object.fromEntries(
      withTanstackLeafColumn.map(item => [
        item.tanstackLeafColumn.id!,
        item.leaf.invisible !== true,
      ])
    )

    let lastFixedIndex: number | null
    if (maxIndexOfIsFixed === -1) {
      lastFixedIndex = showCheckBoxSpecified ? 0 : null
    } else {
      lastFixedIndex = maxIndexOfIsFixed + (showCheckBoxSpecified ? 1 : 0)
    }

    return {
      /** useReactTable の columns に渡す列定義 */
      tanstackColumns,
      columnVisibility,

      /** もっとも右にある固定列のインデックス。固定列が無い場合は null。チェックボックス列がある場合はそれを0とする */
      lastFixedIndex,

      /** グループ列が存在するかどうか */
      hasHeaderGroup,
    }
    // 依存配列は構造シグネチャのみ（固定長）。
    // シグネチャが変化しない限り、列の増減・並べ替え・幅指定・固定指定・可視状態は
    // 変わっていないとみなせるため、このクロージャが捕まえている flatten 等をそのまま使ってよい。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

/** 列定義平坦化後の1要素 */
type FlattenedColumn<TRow> = {
  group?: EditableGrid2GroupColumn<TRow>
  leaf: EditableGrid2LeafColumn<TRow>
}

/**
 * cell / header のレンダリング関数から常に最新の列定義を参照できるようにするための状態。
 * props.columns の参照は依存配列の値が変わるたびに変わるが、TanStack に渡す列定義自体は
 * 構造（列の増減・並べ替え・幅などの構築に必要な項目）が変わらない限り作り直さないため、
 * cell / header のレンダリング関数は「作られた時点」の列定義オブジェクトを直接キャプチャできない。
 * 代わりにこの ref を経由し、columnId をキーに毎回最新の列定義を引き直す。
 */
type LatestColumnsState<TRow> = {
  leafByColumnId: Map<string, EditableGrid2LeafColumn<TRow>>
  groupByColumnId: Map<string, EditableGrid2GroupColumn<TRow>>
  gridIsReadOnly: EditableGrid2Props<TRow>["isReadOnly"]
  showCheckBox: EditableGrid2Props<TRow>["showCheckBox"]
}
