import React from "react"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"
import { createInitialRows, MONTH_COUNT, PerfDataStore, PerfRow } from "./perfDataStore"

/** 行数 */
const ROW_COUNT = 10000

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValueForRerender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<PerfRow>()

/**
 * パフォーマンス実演画面。
 *
 * 1万行 × 45列（45万セル）のグリッドで、以下の操作がいずれも一瞬で終わることを確かめるための画面。
 *
 * - セルを編集すると、同じ行の他の列（差異・年間合計・金額）へ値が波及する
 * - さらに構成比・累計構成比は全行の合計を分母に持つため、すべての行へ値が波及する
 * - グリッドの外側のボタンからも、グリッド内のセルの値をまとめて書き換えられる
 * - 行の追加と、行頭チェックボックスによる行削除ができる
 *
 * 速度の要点は「データを React の state に持たせないこと」と
 * 「描画し直すセルを getValueForRerender の比較で絞り込むこと」。
 * データは {@link PerfDataStore} が React の外側で保持し、
 * EditableGrid2 には rowKeys（行の並び）、getLatestRowObject（値の取得関数）、subscribe（変更通知）を渡す。
 * 値が変わるとグリッドは表示中のセルの getValueForRerender を呼び直し、戻り値が変わったセルだけを描画し直すため、
 * 論理的に1万行が変化しても、実際に再レンダリングされるのは画面に見えている数百セルのうち値が変わったものだけになる。
 */
function PerformanceExample() {

  // データはReactの外側（ただのクラスインスタンス）で保持する。
  // ここが useState だと、1セル編集するたびに1万行分の配列を作り直すことになる。
  const store = React.useMemo(() => new PerfDataStore(createInitialRows(ROW_COUNT)), [])

  // 行の並びだけが React の state。行の追加・削除のときにのみ更新される。
  const [rowKeys, setRowKeys] = React.useState(() => store.getRowKeys())

  const gridRef = React.useRef<EG2.EditableGrid2Ref<PerfRow>>(null)

  // 行追加時に末尾へスクロールするために、グリッドのスクロールコンテナを引くための ref。
  // display: contents のラッパなので、レイアウトには影響しない。
  const gridContainerRef = React.useRef<HTMLDivElement>(null)

  //#region 所要時間の計測

  const [lastOperation, setLastOperation] = React.useState<{ label: string, ms: number }>()

  /**
   * 操作の所要時間を計測する。
   * requestAnimationFrame を2回挟むことで、
   * ストアの書き換えだけでなく React の再レンダリングとブラウザの描画が
   * 終わった後の時刻を計測している。
   */
  const measure = (label: string, action: () => void) => {
    const start = performance.now()
    action()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setLastOperation({ label, ms: performance.now() - start })
    }))
  }

  //#endregion 所要時間の計測
  // -----------------------------
  //#region グリッドの外側からグリッド内部の値を変更する操作

  // 一括設定の対象月と設定値
  const [bulkMonth, setBulkMonth] = React.useState(0)
  const [bulkValue, setBulkValue] = React.useState("100")

  /** 全行の実績に計画値をコピーする（1万行 × 12ヶ月 = 12万セルの書き換え）。 */
  const copyAllPlanToActual = () => measure(
    "全行の実績に計画値をコピー（12万セル）",
    () => store.copyAllPlanToActual()
  )

  /** 全行の計画を1.1倍する（12万セルの書き換え＋全行の構成比の再計算）。 */
  const increaseAllPlan = () => measure(
    "全行の計画を1.1倍（12万セル）",
    () => store.multiplyAllPlan(1.1)
  )

  /** 指定した月の計画を全行まとめて同じ値にする（1万セルの書き換え）。 */
  const setPlanOfMonthForAllRows = () => {
    const value = Number(bulkValue)
    if (!Number.isFinite(value)) {
      window.alert("数値を入力してください。")
      return
    }
    measure(
      `全行の${bulkMonth + 1}月計画を ${value} に設定（1万セル）`,
      () => store.setPlanOfMonthForAllRows(bulkMonth, value)
    )
  }

  /** データを初期状態に戻す。 */
  const resetData = () => measure("データの再生成（1万行）", () => {
    store.replaceAll(createInitialRows(ROW_COUNT))
    setRowKeys(store.getRowKeys())
  })

  //#endregion グリッドの外側からグリッド内部の値を変更する操作
  // -----------------------------
  //#region グリッドの操作による値の変更

  /**
   * セル編集・貼り付け・Delete による変更。1回の操作につき1回、変更のあった行がまとめて渡される。
   * （所要時間の表示はしない。表示のための state 更新でこの画面全体が再描画されてしまうため）
   */
  const handleRowsChange = (updates: EG2.EditableGrid2RowUpdate<PerfRow>[]) => {
    store.applyRowUpdates(updates)
  }

  //#endregion グリッドの操作による値の変更
  // -----------------------------
  //#region 行の追加・削除

  /** 末尾に1行追加し、その行を選択状態にしてスクロールする。 */
  const addRow = () => measure("行追加", () => {
    const addedRowIndex = store.addRow()
    setRowKeys(store.getRowKeys())

    // 行数が増えたことがグリッドに反映された後でないと選択位置がクランプされてしまうため、
    // 次のフレームで選択する。
    requestAnimationFrame(() => {
      gridRef.current?.selectRow(addedRowIndex, addedRowIndex)

      // ref API の selectRow() は選択セルを変えるだけでスクロールは行わない
      // （自動スクロールはキー操作によるセル移動のときだけ働く）ため、
      // 追加した行が見えるよう、スクロール位置は自前で末尾へ動かす。
      const scrollContainer = gridContainerRef.current?.querySelector(".halllky-eg2-root")
      scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight })
    })
  })

  /** 行頭のチェックボックスでチェックされている行を削除する。 */
  const removeCheckedRows = () => {
    const rowIndexes = (gridRef.current?.getCheckedRows() ?? []).map(({ rowIndex }) => rowIndex)
    if (rowIndexes.length === 0) {
      window.alert("チェックされている行がありません。")
      return
    }
    measure(`${rowIndexes.length.toLocaleString()}行の削除`, () => {
      store.removeRows(rowIndexes)
      setRowKeys(store.getRowKeys())
    })
  }

  //#endregion 行の追加・削除
  // -----------------------------
  //#region 列定義

  // 列定義の参照を安定させるため useMemo で包む。
  // 中で参照している外側の値は store だけ（store の参照は変わらない）。
  const columns = React.useMemo((): EG2.EditableGrid2Column<PerfRow>[] => {

    /** 左端に固定される列 */
    const fixedColumns: EG2.EditableGrid2Column<PerfRow>[] = [col.leaf({
      columnId: "no",
      renderHeader: () => <HeaderText>No.</HeaderText>,
      // 行インデックスしか使わないので getValueForRerender は不要
      renderBody: ({ rowIndex }) => <CellText align="right">{rowIndex + 1}</CellText>,
      defaultWidth: 64,
      disableResizing: true,
      isFixed: true,
      isReadOnly: true,
    }), col.leaf({
      columnId: "code",
      renderHeader: () => <HeaderText>品目コード</HeaderText>,
      getValueForRerender: row => [row.code],
      renderBody: ({ deps: [code] }) => <CellText>{code}</CellText>,
      getText: row => row.code, // コピーはできるが編集・貼り付けはできない列
      defaultWidth: 88,
      isFixed: true,
      isReadOnly: true,
    }), col.leaf({
      columnId: "name",
      editor: TextEditor,
      renderHeader: () => <HeaderText>品目名</HeaderText>,
      // 自分のセルの値だけに依存する。他の列が編集されてもこのセルは描画し直されない。
      getValueForRerender: row => [row.name],
      renderBody: ({ deps: [name] }) => <CellText>{name}</CellText>,
      getText: row => row.name,
      setText: (row, text) => ({ ...row, name: text }),
      defaultWidth: 120,
      isFixed: true,
    })]

    /** 集計列。いずれも他のセルの編集結果が波及してくる計算列。 */
    const summaryColumns: EG2.EditableGrid2Column<PerfRow>[] = [col.leaf({
      columnId: "unitPrice",
      editor: TextEditor,
      renderHeader: () => <HeaderText>単価</HeaderText>,
      getValueForRerender: row => [row.unitPrice],
      renderBody: ({ deps: [unitPrice] }) => <CellText align="right">{formatNumber(unitPrice)}</CellText>,
      getText: row => String(row.unitPrice),
      setText: (row, text) => {
        const parsed = parseNumber(text)
        return parsed === undefined ? undefined : { ...row, unitPrice: parsed }
      },
      defaultWidth: 80,
    }), col.leaf({
      columnId: "planTotal",
      // 【同じ行の他の列への波及】12ヶ月の計画セルのいずれかが編集されると変化する。
      // 計算結果そのものを比較対象にするので、どのセルに依存するかを列挙する必要は無い。
      renderHeader: () => <HeaderText>年間計画</HeaderText>,
      getValueForRerender: row => [store.getPlanTotal(row)],
      renderBody: ({ deps: [planTotal] }) => <CellText align="right">{formatNumber(planTotal)}</CellText>,
      getText: row => String(store.getPlanTotal(row)),
      defaultWidth: 88,
      isReadOnly: true,
    }), col.leaf({
      columnId: "actualTotal",
      // 【同じ行の他の列への波及】12ヶ月の実績セルのいずれかが編集されると変化する
      renderHeader: () => <HeaderText>年間実績</HeaderText>,
      getValueForRerender: row => [store.getActualTotal(row)],
      renderBody: ({ deps: [actualTotal] }) => <CellText align="right">{formatNumber(actualTotal)}</CellText>,
      getText: row => String(store.getActualTotal(row)),
      defaultWidth: 88,
      isReadOnly: true,
    }), col.leaf({
      columnId: "amount",
      // 【同じ行の他の列への波及】単価と12ヶ月の計画セルのいずれかが編集されると変化する
      renderHeader: () => <HeaderText>年間計画金額</HeaderText>,
      getValueForRerender: row => [store.getAmount(row)],
      renderBody: ({ deps: [amount] }) => <CellText align="right">{formatNumber(amount)}</CellText>,
      getText: row => String(store.getAmount(row)),
      defaultWidth: 112,
      isReadOnly: true,
    }), col.leaf({
      columnId: "share",
      // 【他の行への波及】分母が全行の年間計画の合計なので、
      // どの行のどの計画セルが編集されても、全行のこの列の値が変わる。
      // ただし1万行のうちの1セルぶんの影響なので、値の動きはごくわずか。
      // 表示する桁数に丸めた文字列を比較対象にすると、表示が変わらないセルは描画し直されない。
      renderHeader: () => <HeaderText>構成比</HeaderText>,
      getValueForRerender: row => [store.getShare(row).toFixed(6)],
      renderBody: ({ deps: [share] }) => <CellText align="right">{share} %</CellText>,
      getText: row => store.getShare(row).toFixed(6),
      defaultWidth: 104,
      isReadOnly: true,
    }), col.leaf({
      columnId: "cumulativeShare",
      // 【他の行への波及】先頭行からこの行までの累計 ÷ 全行の合計（ABC分析でよく使う形）。
      // 編集した行より下のすべての行の分子が変わるため、
      // 1セルの編集でも他の行の値がはっきり動くのが目で見て分かる。
      renderHeader: () => <HeaderText>累計構成比</HeaderText>,
      getValueForRerender: (_, rowIndex) => [store.getCumulativeShare(rowIndex).toFixed(3)],
      renderBody: ({ deps: [cumulativeShare] }) => <CellText align="right">{cumulativeShare} %</CellText>,
      getText: (_, rowIndex) => store.getCumulativeShare(rowIndex).toFixed(3),
      defaultWidth: 104,
      isReadOnly: true,
    })]

    /**
     * 1月から12月までの月別列。1ヶ月あたり3列（計画・実績・差異）で、合計36列。
     * 列定義をベタ書きせずループで生成することで、列数が多くても定義が膨らまないようにしている。
     */
    const monthColumns: EG2.EditableGrid2GroupColumn<PerfRow>[] = Array.from(
      { length: MONTH_COUNT },
      (_, month): EG2.EditableGrid2GroupColumn<PerfRow> => ({
        columnId: `month-${month}`,
        renderHeader: () => <HeaderText>{month + 1}月</HeaderText>,
        columns: [col.leaf({
          columnId: `plan-${month}`,
          editor: TextEditor,
          renderHeader: () => <HeaderText>計画</HeaderText>,
          getValueForRerender: row => [row.plan[month]],
          renderBody: ({ deps: [plan] }) => <CellText align="right">{formatNumber(plan)}</CellText>,
          getText: row => String(row.plan[month]),
          setText: (row, text) => {
            const parsed = parseNumber(text)
            if (parsed === undefined) return undefined
            const plan = [...row.plan]
            plan[month] = parsed
            return { ...row, plan }
          },
          defaultWidth: 64,
        }), col.leaf({
          columnId: `actual-${month}`,
          editor: TextEditor,
          renderHeader: () => <HeaderText>実績</HeaderText>,
          getValueForRerender: row => [row.actual[month]],
          renderBody: ({ deps: [actual] }) => <CellText align="right">{formatNumber(actual)}</CellText>,
          getText: row => String(row.actual[month]),
          setText: (row, text) => {
            const parsed = parseNumber(text)
            if (parsed === undefined) return undefined
            const actual = [...row.actual]
            actual[month] = parsed
            return { ...row, actual }
          },
          defaultWidth: 64,
        }), col.leaf({
          columnId: `diff-${month}`,
          // 【同じ行の他の列への波及】同じ月の計画・実績のどちらが編集されても変化する。
          // マイナスのときだけ赤くすることで、値の波及を目で追いやすくしている。
          renderHeader: () => <HeaderText>差異</HeaderText>,
          getValueForRerender: row => [store.getDiff(row, month)],
          renderBody: ({ deps: [diff] }) => (
            <CellText align="right" className={diff < 0 ? "text-rose-600" : undefined}>
              {formatNumber(diff)}
            </CellText>
          ),
          getText: row => String(store.getDiff(row, month)),
          defaultWidth: 64,
          isReadOnly: true,
        })],
      })
    )

    return [...fixedColumns, ...summaryColumns, ...monthColumns]
  }, [store])

  //#endregion 列定義

  // 固定列3 + 集計列6 + 月別列（12ヶ月 × 計画/実績/差異）
  const columnCount = 3 + 6 + MONTH_COUNT * 3

  return (
    <div className="flex flex-col gap-2 p-2">

      {/* グリッドの外側からグリッド内部の値を変更する操作 */}
      <div className="flex justify-between items-start text-sm">
        <div className="flex flex-col items-start gap-x-2 gap-y-1">
          <ToolbarButton onClick={copyAllPlanToActual}>
            全行の実績に計画値をコピー
          </ToolbarButton>
          <ToolbarButton onClick={increaseAllPlan}>
            全行の計画を1.1倍
          </ToolbarButton>
          <span className="flex items-center gap-1">
            <select
              value={bulkMonth}
              onChange={e => setBulkMonth(Number(e.target.value))}
              className="px-1 border border-gray-500 bg-white cursor-pointer"
            >
              {Array.from({ length: MONTH_COUNT }, (_, month) => (
                <option key={month} value={month}>{month + 1}月</option>
              ))}
            </select>
            <span>の計画を全行</span>
            <input
              type="number"
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
              className="w-20 px-1 border border-gray-500 bg-white"
            />
            <ToolbarButton onClick={setPlanOfMonthForAllRows}>
              に設定
            </ToolbarButton>
          </span>
          {/* 行の追加・削除 */}
          <span className="flex items-center gap-1">
            <span className="text-gray-500">行の増減:</span>
            <ToolbarButton onClick={addRow}>
              行を追加
            </ToolbarButton>
            <ToolbarButton onClick={removeCheckedRows}>
              チェックした行を削除
            </ToolbarButton>
          </span>
        </div>

        <ToolbarButton onClick={resetData}>
          データを初期状態に戻す
        </ToolbarButton>
      </div>

      {/* 規模と所要時間の表示 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          {rowKeys.length.toLocaleString()} 行 × {columnCount} 列
          = {(rowKeys.length * columnCount).toLocaleString()} セル
        </span>
        <span className="text-gray-500">
          {lastOperation
            ? `直前の操作: ${lastOperation.label} … 再描画完了まで ${lastOperation.ms.toFixed(1)} ms`
            : "直前の操作: （まだ操作していません）"}
        </span>
      </div>

      <div ref={gridContainerRef} className="contents">
        <EG2.EditableGrid2
          ref={gridRef}
          rowKeys={rowKeys}
          getLatestRowObject={index => store.getRowAt(index)}
          subscribe={store.subscribe}
          onRowsChange={handleRowsChange}
          columns={columns}
          showCheckBox
          striped
          className="h-[32rem] border border-gray-500 resize-y"

          // 描画範囲外を何行（何列）描画しておくか。
          // 高速スクロール時に表示が遅れる場合は大きめに、
          // そこまで気にならない場合は小さめに設定する。
          // 未指定の場合は既定値が使われる。
          rowOverscan={80}
          columnOverscan={15}
        />
      </div>
    </div>
  )
}

//#region セルのレンダリング

/** セルの基本的スタイルを施したもの */
function CellText({ align, className, children }: {
  align?: "right"
  className?: string
  children?: React.ReactNode
}) {
  return (
    <span className={[
      "px-1 py-px border border-transparent text-sm truncate",
      align === "right" ? "text-right" : "",
      className ?? "",
    ].join(" ")}>
      {children}
    </span>
  )
}

/** 列ヘッダの基本的スタイルを施したもの */
function HeaderText({ children }: { children?: React.ReactNode }) {
  return (
    <span className="px-1 py-px text-sm text-gray-700 truncate">
      {children}
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

//#endregion セルのレンダリング

const numberFormat = new Intl.NumberFormat("ja-JP")

function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/**
 * セルエディタやクリップボードから渡ってきた文字列を数値に変換する。
 * 空文字（Deleteキーによるクリアや空セルの貼り付け）は 0 として扱い、
 * 数値として解釈できない文字列は undefined を返して元の値を保つ。
 */
function parseNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(/,/g, "")
  if (trimmed === "") return 0
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

const storybookSetting: Meta<typeof PerformanceExample> = {
  title: "パフォーマンス",
  component: PerformanceExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const パフォーマンス: StoryObj<typeof storybookSetting> = {}
