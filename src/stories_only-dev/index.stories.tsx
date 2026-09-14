import React from "react"
import * as TanStack from "@tanstack/react-table"
import * as TanStackVirtual from "@tanstack/react-virtual"
import { Meta, StoryObj } from "@storybook/react-vite"

/**
 * この画面は EditableGrid2 とは無関係の、TanStack Table v9 そのものの
 * 速度を測るための実験用ページ。EditableGrid2 の実装は一切経由しない。
 *
 * 測りたいのは「data の参照を差し替えたときにコア行モデル（getRowModel）の
 * 作り直しにどれだけ時間がかかるか」と、「そのあとの React の再レンダリング・
 * ブラウザの描画にどれだけ時間がかかるか」の切り分け。
 */

/** 行数 */
const ROW_COUNT = 2000
/** 列数 */
const COLUMN_COUNT = 100
/** 列幅(px)。columnSizingFeature を登録していないので table からは引かず定数で持つ */
const COLUMN_WIDTH = 80
/** 行高さ(px)。行の高さは固定なので動的計測（measureElement）は行わない */
const ROW_HEIGHT = 24

type ExperimentRow = {
  rowId: string
  /** 列数ぶんのセル値 */
  cells: number[]
}

/**
 * 全行ぶんのデータを作成する。
 * generation を変えるとすべてのセルの値が変わる。
 */
function createRows(generation: number): ExperimentRow[] {
  const rows = new Array<ExperimentRow>(ROW_COUNT)
  for (let r = 0; r < ROW_COUNT; r++) {
    const cells = new Array<number>(COLUMN_COUNT)
    for (let c = 0; c < COLUMN_COUNT; c++) {
      cells[c] = (r * 31 + c * 7 + generation * 13) % 10000
    }
    rows[r] = { rowId: `row-${r}`, cells }
  }
  return rows
}

// TanStack Table v9 の素の速度を測るのが目的なので、機能（feature）は一切登録しない。
// 行選択・列サイズ・並べ替えなどを足すとその分の処理が計測結果に混ざるため。
const features = TanStack.tableFeatures({})

const columnHelper = TanStack.createColumnHelper<typeof features, ExperimentRow>()

// 列定義はモジュールスコープで1度だけ作る。
// レンダリングのたびに作り直すと列モデルも作り直しになり、行モデルの計測がぶれる。
const columns = columnHelper.columns(
  Array.from({ length: COLUMN_COUNT }, (_, colIndex) => columnHelper.accessor(
    row => row.cells[colIndex],
    {
      id: `col-${colIndex}`,
      header: `列${colIndex + 1}`,
      cell: ctx => ctx.getValue(),
    },
  ))
)

/** 行キーの取得関数。参照が変わると useTable のオプションが変わるのでモジュールスコープに置く */
const getRowId = (row: ExperimentRow) => row.rowId

/** 計測中の操作。ボタン押下時に積み、レンダリング後の副作用で確定させる */
type PendingMeasure = {
  label: string
  /** 計測開始時刻 */
  startedAt: number
  /** データ生成にかかった時間(ms) */
  dataMs: number
}

/** 計測結果。dataMs 以外はいずれも計測開始時点からの累計 */
type MeasureResult = {
  label: string
  dataMs: number
  /** getRowModel() の所要時間(ms)。コア行モデルの作り直しにかかった時間 */
  rowModelMs: number
  /** React のレンダリングと DOM 反映が終わるまでの累計時間(ms) */
  commitMs: number
  /** ブラウザの描画が終わるまでの累計時間(ms) */
  paintMs: number
  /** そのとき実際に描画されていたセル数 */
  renderedCellCount: number
}

/**
 * TanStack Table v9 単体のパフォーマンス実験ページ。
 *
 * 2000行 × 100列（20万セル）を行・列とも仮想化して描画し、
 * 「全セルの値を更新」ボタンで data の参照ごと差し替えたときの所要時間を、
 * データ生成 / コア行モデルの作り直し / React の再レンダリング / ブラウザ描画 に分けて表示する。
 */
function TanStackV9PerformanceExperiment() {

  const [rows, setRows] = React.useState(() => createRows(0))
  const generationRef = React.useRef(0)
  const [, forceRerender] = React.useReducer((x: number) => x + 1, 0)

  // TanStack 組み込みのデバッグログ（各メモ関数の所要時間をコンソールに出力する）
  const [debugAll, setDebugAll] = React.useState(false)

  // オプションの参照が変わると useTable が返すテーブルオブジェクトも変わるため、
  // data と debugAll が変わったときだけ作り直す。
  const tableOptions = React.useMemo(() => ({
    features,
    columns,
    data: rows,
    getRowId,
    debugAll,
  }), [rows, debugAll])

  const table = TanStack.useTable(tableOptions)

  //#region 所要時間の計測

  const pendingRef = React.useRef<PendingMeasure>(undefined)
  const rowModelMsRef = React.useRef(0)
  const renderedCellCountRef = React.useRef(0)
  const [result, setResult] = React.useState<MeasureResult>()

  // コア行モデルの作り直しの計測。
  // v9 の行モデルは遅延評価（getRowModel() を呼んだ時点で deps が変わっていれば作り直す）なので、
  // 呼び出しを挟んで計測すればそのまま作り直しの所要時間になる。
  // data の参照が変わっていなければメモが効くのでほぼ 0ms になる。
  const rowModelStart = performance.now()
  const rowModel = table.getRowModel()
  rowModelMsRef.current = performance.now() - rowModelStart

  // useLayoutEffect は DOM 反映後・ブラウザ描画前に同期的に呼ばれるので、ここまでがコミット完了。
  // ブラウザの描画完了は requestAnimationFrame を2回挟んで待つ。
  React.useLayoutEffect(() => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = undefined

    const rowModelMs = rowModelMsRef.current
    const renderedCellCount = renderedCellCountRef.current
    const commitMs = performance.now() - pending.startedAt
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setResult({
        label: pending.label,
        dataMs: pending.dataMs,
        rowModelMs,
        commitMs,
        paintMs: performance.now() - pending.startedAt,
        renderedCellCount,
      })
    }))
  })

  /** 全セルの値を更新する。data の参照が変わるのでコア行モデルが作り直される。 */
  const updateAllCells = () => {
    generationRef.current += 1
    const startedAt = performance.now()
    const nextRows = createRows(generationRef.current)
    const dataMs = performance.now() - startedAt
    pendingRef.current = { label: "全セルの値を更新", startedAt, dataMs }
    setRows(nextRows)
  }

  /** data を据え置いたまま再レンダリングする。行モデルの作り直しが無い場合との比較用。 */
  const rerenderOnly = () => {
    pendingRef.current = {
      label: "再レンダリングのみ（data 据え置き）",
      startedAt: performance.now(),
      dataMs: 0,
    }
    forceRerender()
  }

  //#endregion 所要時間の計測
  // -----------------------------
  //#region 仮想化

  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  // 行の仮想化。仮想化の対象は生データではなく行モデルの行。
  const tableRows = rowModel.rows
  const rowVirtualizer = TanStackVirtual.useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: React.useCallback((index: number) => tableRows[index].id, [tableRows]),
  })

  // 列の仮想化
  const leafColumns = table.getAllLeafColumns()
  const columnVirtualizer = TanStackVirtual.useVirtualizer({
    horizontal: true,
    count: leafColumns.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => COLUMN_WIDTH,
    overscan: 3,
    getItemKey: React.useCallback((index: number) => leafColumns[index].id, [leafColumns]),
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualColumns = columnVirtualizer.getVirtualItems()
  const totalWidth = columnVirtualizer.getTotalSize()
  const headers = table.getHeaderGroups()[0].headers

  renderedCellCountRef.current = virtualRows.length * virtualColumns.length

  //#endregion 仮想化

  return (
    <div className="flex flex-col gap-2 p-2">

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <ToolbarButton onClick={updateAllCells}>
          全セルの値を更新
        </ToolbarButton>
        <ToolbarButton onClick={rerenderOnly}>
          再レンダリングのみ
        </ToolbarButton>
        <label className="flex items-center gap-1 select-none">
          <input
            type="checkbox"
            checked={debugAll}
            onChange={e => setDebugAll(e.target.checked)}
          />
          TanStack の debugAll ログを出力（コンソール。計測値は重くなる）
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
        <span>
          {formatNumber(ROW_COUNT)}行 × {formatNumber(COLUMN_COUNT)}列
          （{formatNumber(ROW_COUNT * COLUMN_COUNT)}セル）
        </span>
        <span>
          描画中: {virtualRows.length}行 × {virtualColumns.length}列
          （{formatNumber(virtualRows.length * virtualColumns.length)}セル）
        </span>
      </div>

      <MeasureResultView result={result} />

      <div
        ref={scrollContainerRef}
        className="h-[32rem] border border-gray-500 overflow-auto resize-y"
      >
        {/* 横幅ぶんの器。ヘッダとボディを縦に積むだけなので高さは指定しない */}
        <div style={{ width: totalWidth }}>

          {/* ヘッダ。position: sticky なので、内部のセルの絶対配置の基準にもなる */}
          <div
            className="sticky top-0 z-10 bg-gray-100 border-b border-gray-400"
            style={{ height: ROW_HEIGHT }}
          >
            {virtualColumns.map(virtualColumn => {
              const header = headers[virtualColumn.index]
              return (
                <div
                  key={header.id}
                  className="absolute top-0 px-1 text-sm text-gray-700 truncate border-r border-gray-300"
                  style={{
                    left: virtualColumn.start,
                    width: virtualColumn.size,
                    height: ROW_HEIGHT,
                    lineHeight: `${ROW_HEIGHT}px`,
                  }}
                >
                  <table.FlexRender header={header} />
                </div>
              )
            })}
          </div>

          {/* ボディ。行の総高さぶんの器の中に、表示中の行だけを絶対配置する */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {virtualRows.map(virtualRow => {
              const row = tableRows[virtualRow.index]
              const cells = row.getAllCells()
              return (
                <div
                  key={row.id}
                  className="absolute left-0"
                  style={{
                    top: virtualRow.start,
                    height: virtualRow.size,
                    width: totalWidth,
                  }}
                >
                  {virtualColumns.map(virtualColumn => {
                    const cell = cells[virtualColumn.index]
                    return (
                      <div
                        key={cell.id}
                        className="absolute top-0 px-1 text-sm text-right truncate border-r border-b border-gray-200"
                        style={{
                          left: virtualColumn.start,
                          width: virtualColumn.size,
                          height: virtualRow.size,
                          lineHeight: `${virtualRow.size}px`,
                        }}
                      >
                        <table.FlexRender cell={cell} />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 計測結果の表示 */
function MeasureResultView({ result }: { result: MeasureResult | undefined }) {
  if (!result) return (
    <div className="text-sm text-gray-500">
      ボタンを押すと所要時間が表示されます。
    </div>
  )
  return (
    <div className="flex flex-col gap-px text-sm">
      <span className="font-bold">{result.label}</span>
      <MeasureRow
        label="① データ生成（TanStack の外側）"
        ms={result.dataMs}
      />
      <MeasureRow
        label="② コア行モデルの作り直し（getRowModel）"
        ms={result.rowModelMs}
      />
      <MeasureRow
        label="③ React のレンダリングと DOM 反映まで（①②込みの累計）"
        ms={result.commitMs}
      />
      <MeasureRow
        label="④ ブラウザの描画完了まで（累計）"
        ms={result.paintMs}
      />
      <span className="text-gray-500">
        このとき描画されていたセル数: {formatNumber(result.renderedCellCount)}
      </span>
    </div>
  )
}

function MeasureRow({ label, ms }: { label: string, ms: number }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-gray-500">{label}:</span>
      <span className="tabular-nums">{ms.toFixed(1)} ms</span>
    </span>
  )
}

/** ツールバーのボタン */
function ToolbarButton({ onClick, children }: {
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 border border-gray-500 bg-white cursor-pointer"
    >
      {children}
    </button>
  )
}

const numberFormat = new Intl.NumberFormat("ja-JP")

function formatNumber(value: number): string {
  return numberFormat.format(value)
}

const storybookSetting: Meta<typeof TanStackV9PerformanceExperiment> = {
  title: "実験/TanStack Table v9 単体性能",
  component: TanStackV9PerformanceExperiment,
}

export default storybookSetting

export const TanStackTableV9単体性能: StoryObj<typeof storybookSetting> = {}
