/**
 * パフォーマンス実演画面のデータストア。
 *
 * 1万行 × 45列（= 45万セル）のデータを React の state ではなく
 * ただの配列として保持し、値が変わったことだけを購読者（EditableGrid）へ通知する。
 *
 * EditableGrid は行の値を自身では保持せず、描画のたびに
 * getLatestRowObject で最新の値を取りにくる。
 * 通知を受けたグリッドは、表示中のセルごとに列定義の getValuesForRender の戻り値を前回と比較し、
 * 変わったセルだけを描画し直す。そのため、このストアは「どのセルが変わったか」を管理する必要が無い。
 *
 * これは EditableGrid ライブラリ本体の一部ではなく、実装例（Storybook 用）です。
 */

/** 月の数。1月から12月まで。 */
export const MONTH_COUNT = 12

/** データ1行分。計算列（合計・差異・構成比など）は保持せず、そのつど算出する。 */
export type PerfRow = {
  rowId: string
  /** 品目コード */
  code: string
  /** 品目名 */
  name: string
  /** 単価 */
  unitPrice: number
  /** 各月の計画数量。index 0 が1月。 */
  plan: number[]
  /** 各月の実績数量。index 0 が1月。 */
  actual: number[]
}

type Listener = () => void

/** パフォーマンス実演画面のデータストア。React には依存しない。 */
export class PerfDataStore {

  constructor(rows: PerfRow[]) {
    this.#rows = rows
    this.#grandPlanTotal = rows.reduce((sum, row) => sum + sumOf(row.plan), 0)
    this.#nextSerial = rows.length + 1
  }

  #rows: PerfRow[]
  /** 全行の年間計画数量の合計。構成比の分母。行単位の更新時は差分だけ加減算して維持する。 */
  #grandPlanTotal: number
  /** 行追加時に採番する通し番号 */
  #nextSerial: number
  /**
   * 先頭行から各行までの年間計画数量の累計。累計構成比の分子。
   * どこか1行の計画が変わるとその行より下の全要素が変わるため、
   * 差分更新はせず、null（＝要再計算）にしておいて次に参照されたときにまとめて作り直す。
   */
  #cumulativePlanTotals: number[] | null = null
  /** 購読者。表示中のグリッドの数だけ存在する。 */
  #listeners = new Set<Listener>()

  //#region 購読

  /**
   * 値の変更を購読する。EditableGrid の subscribe にそのまま渡せるよう、参照が変わらないアロー関数で定義している。
   */
  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /** 購読者へ値が変わったことを通知する。 */
  #emit(): void {
    for (const listener of this.#listeners) listener()
  }

  //#endregion 購読
  // -----------------------------
  //#region 参照

  getRowCount(): number {
    return this.#rows.length
  }

  /** EditableGrid の getLatestRowObject に渡す。 */
  getRowAt(rowIndex: number): PerfRow {
    return this.#rows[rowIndex]
  }

  /** EditableGrid の rowKeys に渡す配列を作る。行が増減したときだけ作り直す。 */
  getRowKeys(): string[] {
    return this.#rows.map(row => row.rowId)
  }

  /** 年間計画数量。同じ行の plan-0 〜 plan-11 から算出される計算列。 */
  getPlanTotal(row: PerfRow): number {
    return sumOf(row.plan)
  }

  /** 年間実績数量。同じ行の actual-0 〜 actual-11 から算出される計算列。 */
  getActualTotal(row: PerfRow): number {
    return sumOf(row.actual)
  }

  /** 指定月の差異（実績 - 計画）。同じ行の同じ月の2セルから算出される計算列。 */
  getDiff(row: PerfRow, month: number): number {
    return row.actual[month] - row.plan[month]
  }

  /** 年間計画金額。同じ行の単価と年間計画数量から算出される計算列。 */
  getAmount(row: PerfRow): number {
    return this.getPlanTotal(row) * row.unitPrice
  }

  /**
   * 構成比（%）。自分の年間計画数量 ÷ 全行の年間計画数量。
   * 分母が他の行の値に依存するため、どこか1セルを編集すると全行の値が変わる計算列。
   * 分母は常に保持しているので、呼び出しごとのコストは1行分の計算だけで済む。
   */
  getShare(row: PerfRow): number {
    if (this.#grandPlanTotal === 0) return 0
    return this.getPlanTotal(row) / this.#grandPlanTotal * 100
  }

  /**
   * 累計構成比（%）。先頭行からこの行までの年間計画数量の累計 ÷ 全行の年間計画数量。
   * ABC分析で使われる形の計算列。
   *
   * ある行の計画を編集すると、その行より下のすべての行の分子が変わり、
   * さらに分母も変わるため、全行の値が変化する。
   * 構成比と違って1セルの編集でも値がはっきり動くため、
   * 他の行への波及を目で確認しやすい。
   */
  getCumulativeShare(rowIndex: number): number {
    if (this.#grandPlanTotal === 0) return 0

    // 参照されたときにまとめて作り直す。
    // 1回の変更につき1回（表示中のセルの数だけ繰り返されることはない）。
    if (this.#cumulativePlanTotals === null) {
      const cumulative = new Array<number>(this.#rows.length)
      let sum = 0
      for (let i = 0; i < this.#rows.length; i++) {
        sum += sumOf(this.#rows[i].plan)
        cumulative[i] = sum
      }
      this.#cumulativePlanTotals = cumulative
    }

    return (this.#cumulativePlanTotals[rowIndex] ?? 0) / this.#grandPlanTotal * 100
  }

  //#endregion 参照
  // -----------------------------
  //#region グリッドの操作による更新

  /**
   * EditableGrid の onRowsChange から渡された行で置き換える。
   * 1回のセル編集・貼り付けにつき1回だけ呼ばれ、通知も1回だけ行う。
   */
  applyRowUpdates(updates: { rowIndex: number, row: PerfRow }[]): void {
    for (const { rowIndex, row } of updates) {
      const before = this.#rows[rowIndex]
      if (!before) continue
      this.#grandPlanTotal += sumOf(row.plan) - sumOf(before.plan)
      this.#rows[rowIndex] = row
    }
    this.#cumulativePlanTotals = null
    this.#emit()
  }

  //#endregion グリッドの操作による更新
  // -----------------------------
  //#region グリッドの外側からの一括更新

  /** 全行・全ての月の実績に計画値をコピーする。 */
  copyAllPlanToActual(): void {
    for (const row of this.#rows) {
      for (let month = 0; month < MONTH_COUNT; month++) {
        row.actual[month] = row.plan[month]
      }
    }
    this.#emit()
  }

  /** 全行・全ての月の計画数量を指定倍率で増減させる（小数は四捨五入）。 */
  multiplyAllPlan(rate: number): void {
    for (const row of this.#rows) {
      for (let month = 0; month < MONTH_COUNT; month++) {
        row.plan[month] = Math.round(row.plan[month] * rate)
      }
    }
    this.#recalcGrandPlanTotal()
    this.#emit()
  }

  /** 指定した月の計画数量を、全行まとめて同じ値にする。 */
  setPlanOfMonthForAllRows(month: number, value: number): void {
    for (const row of this.#rows) {
      row.plan[month] = value
    }
    this.#recalcGrandPlanTotal()
    this.#emit()
  }

  /** データを丸ごと差し替える。行が増減するため、呼び出し側で rowKeys を取り直すこと。 */
  replaceAll(rows: PerfRow[]): void {
    this.#rows = rows
    this.#nextSerial = rows.length + 1
    this.#recalcGrandPlanTotal()
    this.#emit()
  }

  //#endregion グリッドの外側からの一括更新
  // -----------------------------
  //#region 行の増減

  /** 末尾に空の行を1行追加し、追加された行のインデックスを返す。 */
  addRow(): number {
    const serial = this.#nextSerial++
    this.#rows.push({
      rowId: `row-${serial}`,
      code: `A-${serial.toString().padStart(5, "0")}`,
      name: "",
      unitPrice: 0,
      plan: new Array<number>(MONTH_COUNT).fill(0),
      actual: new Array<number>(MONTH_COUNT).fill(0),
    })
    this.#cumulativePlanTotals = null
    this.#emit()
    return this.#rows.length - 1
  }

  /** 指定したインデックスの行を削除する。 */
  removeRows(rowIndexes: number[]): void {
    const removing = new Set(rowIndexes)
    this.#rows = this.#rows.filter((_, index) => !removing.has(index))
    this.#recalcGrandPlanTotal()
    this.#emit()
  }

  //#endregion 行の増減
  // -----------------------------
  //#region 内部処理

  #recalcGrandPlanTotal(): void {
    this.#grandPlanTotal = this.#rows.reduce((sum, row) => sum + sumOf(row.plan), 0)
    this.#cumulativePlanTotals = null
  }

  //#endregion 内部処理
}

function sumOf(values: number[]): number {
  let sum = 0
  for (const value of values) sum += value
  return sum
}

/** 実演用のデータを生成する。何度実行しても同じ内容になるよう疑似乱数で作る。 */
export function createInitialRows(count: number): PerfRow[] {
  const names = ["りんご", "みかん", "ぶどう", "バナナ", "洗剤", "ティッシュ", "歯ブラシ", "乾電池", "ノート", "ボールペン"]

  // 線形合同法による疑似乱数（毎回同じ並びのデータを作るため Math.random は使わない）
  let seed = 20260913
  const random = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }

  return Array.from({ length: count }, (_, i): PerfRow => {
    const serial = i + 1
    const base = Math.floor(random() * 90) + 10
    return {
      rowId: `row-${serial}`,
      code: `A-${serial.toString().padStart(5, "0")}`,
      name: `${names[i % names.length]}${Math.floor(i / names.length) + 1}`,
      unitPrice: (Math.floor(random() * 99) + 1) * 100,
      plan: Array.from({ length: MONTH_COUNT }, () => base + Math.floor(random() * 20)),
      actual: Array.from({ length: MONTH_COUNT }, () => base + Math.floor(random() * 20)),
    }
  })
}
