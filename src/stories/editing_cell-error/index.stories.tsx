import React from "react"
import * as ReactHookForm from "react-hook-form"
import { EditableGrid, EditableGridColumn, EditableGridRef, EditableGridRowUpdate, createColumnHelper } from "../../EditableGrid"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = createColumnHelper<TestRow>()

/**
 * セル単位のエラー表示の実演画面。
 *
 * グリッドにはエラー表示のための専用の仕組みは無い。
 * エラーメッセージを renderBody まで届け、セルの中身を利用側で描き分けるだけである。
 *
 * この画面ではエラーの発生源が2種類ある。どちらも結果を React の state に保持する。
 * - クライアント検証: 行の値だけから求まるエラー。描画のたびに計算することもできるが、
 *   それでは行を追加した直後の未入力のセルがいきなりエラーになってしまうため、
 *   検証にかけるタイミング（画面初期表示時・セル編集時・送信時）を利用側で決められるようにしてある。
 * - サーバー検証: 行の値だけからは求まらないエラー（マスタ照合・在庫チェック等）。
 *   その後の行の挿入・入れ替えでエラーが正しい行に付いたままにするため、
 *   エラーと紐づけるのは行インデックスではなく行のキーである必要がある。
 */
function CellErrorExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields, insert, swap, remove, replace } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const gridRef = React.useRef<EditableGridRef<TestRow>>(null)
  const getLatestRowObject = React.useCallback((index: number) => getValues(`rows.${index}`), [getValues])

  // React Hook Form の値が変わったことをグリッドに通知する
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: "rows",
    formState: { values: true },
    callback: onChange,
  }), [subscribe])

  // クライアント検証の結果
  const [clientErrors, setClientErrors] = React.useState<CellErrorIndex>(() => new Map())

  // サーバー検証の結果
  const [serverErrors, setServerErrors] = React.useState<ServerError[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // 画面初期表示時、グリッド全体にクライアント検証をかける。
  // デモ画面の表示時に赤いセルが見えていた方が分かりやすいので
  React.useEffect(() => {
    setClientErrors(validateRows(getValues("rows")))
  }, [getValues])

  // サーバーエラーを「行のキー → 列ID → メッセージ」の形に組み替えたもの。
  // セルの描画のたびにエラーの配列を走査すると行数×列数のコストがかかるため、ここで1回だけ索引を作る。
  const serverErrorIndex = React.useMemo((): CellErrorIndex => {
    const index = new Map<string, Partial<Record<ValidatedColumnId, string>>>()
    for (const error of serverErrors) {
      const errorsOfRow = index.get(error.rowId) ?? {}
      errorsOfRow[error.columnId] = error.message
      index.set(error.rowId, errorsOfRow)
    }
    return index
  }, [serverErrors])

  // そのセルに表示するエラーメッセージを返す関数。
  // クライアント検証を優先し、そちらが通っている場合だけサーバー検証の結果を見る。
  const getCellError = React.useCallback((row: TestRow, columnId: ValidatedColumnId): string | undefined => {
    return clientErrors.get(row.rowId)?.[columnId] ?? serverErrorIndex.get(row.rowId)?.[columnId]
  }, [clientErrors, serverErrorIndex])

  // グリッドの操作（セルエディタ編集・クリップボード貼り付け・Delete）による変更確定時処理。
  // 値の変更を React Hook Form に反映し、クライアント検証をかける。
  const handleRowsChange = React.useCallback((updates: EditableGridRowUpdate<TestRow>[]) => {
    for (const { rowIndex, row } of updates) setValue(`rows.${rowIndex}`, row)

    // セル編集時のクライアント検証
    setClientErrors(prev => {
      let next: Map<string, Partial<Record<ValidatedColumnId, string>>> | undefined
      for (const { row, changedColumnIds } of updates) {

        // 編集していない隣の未入力のセルまでエラーになるのが嫌なので
        // 行全体ではなく変更されたセルだけを検証し直す
        const columnIds = changedColumnIds.filter(isValidatedColumnId)
        if (columnIds.length === 0) continue

        next ??= new Map(prev)
        next.set(row.rowId, { ...next.get(row.rowId), ...validateRow(row, columnIds) })
      }
      return next ?? prev
    })

    // 値が変わったセルに付いていたサーバーエラーをクリアする。
    // サーバーエラーは「送信した時点の値」に対する指摘なので、値が変わった時点で古い情報になるため。
    setServerErrors(prev => prev.filter(error => !updates.some(update => (
      update.row.rowId === error.rowId
      && update.changedColumnIds.includes(error.columnId)
    ))))
  }, [setValue])

  // 擬似的なサーバー送信。行のIDと送信時点の行番号の両方を控えたエラーが返ってくる。
  const handleSubmit = async () => {
    // 送信時のクライアント検証。全行・全列にかける。
    // 行を追加したまま一度も編集していないセルは、ここで初めてエラーが付く。
    // 実際のアプリケーションではエラーがあれば送信を中止するところだが、
    // この画面ではサーバー検証の挙動を確かめられるよう、中止せずそのまま送信する。
    setClientErrors(validateRows(getValues("rows")))

    setIsSubmitting(true)
    try {
      setServerErrors(await postToServer(getValues("rows")))
    } finally {
      setIsSubmitting(false)
    }
  }

  // 行追加
  const nextRowId = React.useRef(100)
  const insertRow = () => {
    insert(0, { rowId: `R${nextRowId.current++}`, name: "", note: "" })
  }

  // データを初期状態に戻す
  const resetRows = () => {
    const rows = getDefaultValues()
    replace(rows)
    setClientErrors(validateRows(rows))
    setServerErrors([])
  }

  const columns = React.useMemo((): EditableGridColumn<TestRow>[] => [col.leaf({
    columnId: "no",
    renderHeader: () => <CellText>No.</CellText>,
    renderBody: ({ rowIndex }) => <CellText>{rowIndex + 1}</CellText>,
    defaultWidth: 40,
    disableResizing: true,
    isFixed: true,
  }), col.leaf({
    columnId: "rowId",
    isReadOnly: true,
    renderHeader: () => <CellText>行ID</CellText>,
    getValuesForRender: row => [row.rowId],
    renderBody: ({ deps: [rowId] }) => <CellText>{rowId}</CellText>,
    defaultWidth: 60,
    isFixed: true,
  }), col.leaf({
    // 商品名（クライアント検証＋サーバー検証） ここから
    columnId: "name",
    editor: TextEditor,
    cellToText: row => row.name ?? "",
    textToCell: (row, text) => ({ ...row, name: text }),
    renderHeader: () => <CellText>商品名</CellText>,

    // エラーメッセージも deps に含める。
    // 含めない場合、値が変わっていないのにエラーだけが変わったときにセルの表示が古いままになる。
    getValuesForRender: row => [row.name, getCellError(row, "name")],

    // セルの中身を描き分けるだけ。グリッド側の仕組みは何も使っていない。
    renderBody: ({ deps: [name, error] }) => <CellText error={error}>{name}</CellText>,
    defaultWidth: 148,
    // 商品名（クライアント検証＋サーバー検証） ここまで
  }), col.leaf({
    columnId: "quantity",
    editor: TextEditor,
    cellToText: row => String(row.quantity ?? ""),
    textToCell: (row, text) => {
      if (text.trim() === "") return { ...row, quantity: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
    },
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: row => [row.quantity, getCellError(row, "quantity")],
    renderBody: ({ deps: [quantity, error] }) => <CellText error={error}>{quantity}</CellText>,
    defaultWidth: 88,
  }), col.leaf({
    columnId: "unitPrice",
    editor: TextEditor,
    cellToText: row => String(row.unitPrice ?? ""),
    textToCell: (row, text) => {
      if (text.trim() === "") return { ...row, unitPrice: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, unitPrice: parsed } : undefined
    },
    renderHeader: () => <CellText>単価</CellText>,
    getValuesForRender: row => [row.unitPrice, getCellError(row, "unitPrice")],
    renderBody: ({ deps: [unitPrice, error] }) => <CellText error={error}>{unitPrice}</CellText>,
    defaultWidth: 88,
  }), col.leaf({
    columnId: "deliveryDate",
    editor: TextEditor,
    cellToText: row => row.deliveryDate ?? "",
    textToCell: (row, text) => ({ ...row, deliveryDate: text.trim() }),
    renderHeader: () => <CellText>納品日</CellText>,
    getValuesForRender: row => [row.deliveryDate, getCellError(row, "deliveryDate")],
    renderBody: ({ deps: [deliveryDate, error] }) => <CellText error={error}>{deliveryDate}</CellText>,
    defaultWidth: 116,
  }), col.leaf({
    // 検証の対象外の列。エラーが無い列では特別なことは何もしない。
    columnId: "note",
    editor: TextEditor,
    cellToText: row => row.note ?? "",
    textToCell: (row, text) => ({ ...row, note: text }),
    renderHeader: () => <CellText>備考</CellText>,
    getValuesForRender: row => [row.note],
    renderBody: ({ deps: [note] }) => <CellText>{note}</CellText>,
    defaultWidth: 180,
  })], [getCellError])

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={insertRow}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          先頭に行を挿入する
        </button>
        <button
          type="button"
          onClick={() => swap(0, 1)}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          1行目と2行目を入れ替える
        </button>
        <button
          type="button"
          onClick={() => remove(0)}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          1行目を削除する
        </button>
        <button
          type="button"
          onClick={resetRows}
          className="px-2 border border-gray-500 bg-white cursor-pointer"
        >
          データを元に戻す
        </button>
      </div>

      <EditableGrid
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="h-64 border border-gray-500 resize-y"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="self-start px-2 text-white border border-gray-700 bg-gray-700 cursor-pointer disabled:bg-gray-400 disabled:cursor-default"
      >
        {isSubmitting ? "サーバーに送信中..." : "サーバーに送信して検証する"}
      </button>

      <ErrorSummary
        control={control}
        getCellError={getCellError}
        onJump={rowIndex => gridRef.current?.selectRow(rowIndex, rowIndex)}
      />
    </div>
  )
}

/**
 * 画面上に表示するエラーメッセージ一覧
 */
function ErrorSummary({ control, getCellError, onJump }: {
  control: ReactHookForm.Control<{ rows: TestRow[] }>
  getCellError: CellErrorGetter
  onJump: (rowIndex: number) => void
}) {
  const rows = ReactHookForm.useWatch({ control, name: "rows" })

  // エラーメッセージを行ごとにまとめる
  const errorsByRow = React.useMemo(() => rows.flatMap((row, rowIndex) => {
    const messages = VALIDATED_COLUMN_IDS
      .map(columnId => getCellError(row, columnId))
      .filter((message): message is string => message !== undefined)
    return messages.length === 0 ? [] : [{ rowIndex, rowId: row.rowId, messages }]
  }), [rows, getCellError])

  if (errorsByRow.length === 0) return (
    <span className="text-sm text-gray-600">エラーはありません。</span>
  )

  return (
    <ul className="flex flex-col gap-px text-sm">
      {errorsByRow.map(({ rowIndex, rowId, messages }) => (
        <li key={rowId}>
          <button
            type="button"
            onClick={() => onJump(rowIndex)}
            className="text-sky-600 underline cursor-pointer"
          >
            {rowIndex + 1}行目（{rowId}）
          </button>
          <span className="text-rose-700">：{messages.join("")}</span>
        </li>
      ))}
    </ul>
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  name?: string
  quantity?: number
  unitPrice?: number
  deliveryDate?: string
  note?: string
}

/** 検証の対象になる列 */
type ValidatedColumnId = "name" | "quantity" | "unitPrice" | "deliveryDate"

const VALIDATED_COLUMN_IDS: ValidatedColumnId[] = ["name", "quantity", "unitPrice", "deliveryDate"]

/** changedColumnIds のような文字列の列IDを、検証の対象の列に絞り込むためのもの */
const isValidatedColumnId = (columnId: string): columnId is ValidatedColumnId => (
  (VALIDATED_COLUMN_IDS as string[]).includes(columnId)
)

/** サーバー検証で返ってきたエラー1件 */
type ServerError = {
  /** 行オブジェクトが持つID。行が動いても変わらない */
  rowId: string
  /** 送信した時点での行番号。行が動くと別の行を指してしまう */
  rowIndex: number
  columnId: ValidatedColumnId
  message: string
}

/** エラーを「行のキー → 列ID → メッセージ」の形に索引付けしたもの */
type CellErrorIndex = ReadonlyMap<string, Partial<Record<ValidatedColumnId, string>>>

/** そのセルに表示するエラーメッセージを返す関数。エラーが無い場合は undefined */
type CellErrorGetter = (row: TestRow, columnId: ValidatedColumnId) => string | undefined

/**
 * クライアント側の検証。列ごとに、その行の値だけを見てエラーメッセージを返す。
 *
 * 行の値だけから求まるので、いつ・どの列に対して実行するかは呼び出し側が決められる。
 * この画面では画面初期表示時と送信時に全列、セル編集時には編集された列だけにかけている。
 */
const clientValidators: Record<ValidatedColumnId, (row: TestRow) => string | undefined> = {
  name: row => {
    if (!row.name?.trim()) return "商品名を入力してください。"
    if (row.name.length > 10) return "商品名は10文字以内で入力してください。"
  },
  quantity: row => {
    if (row.quantity === undefined) return "数量を入力してください。"
    if (!Number.isInteger(row.quantity) || row.quantity <= 0) return "数量は1以上の整数で入力してください。"
  },
  unitPrice: row => {
    if (row.unitPrice === undefined) return "単価を入力してください。"
    if (row.unitPrice < 0) return "単価に負の数は指定できません。"
  },
  deliveryDate: row => {
    if (!row.deliveryDate) return undefined // 未入力は可
    if (parseDate(row.deliveryDate) === undefined) return "納品日は YYYY-MM-DD 形式で入力してください。"
  },
}

/**
 * 1行のうち、指定された列だけにクライアント検証をかけ、「列ID → メッセージ」の形で返す。
 * エラーが無い列にも undefined を設定して返すことで、
 * すでに保持している検証結果に上書きするだけで、直ったセルのエラーが消えるようにしている。
 */
function validateRow(row: TestRow, columnIds: readonly ValidatedColumnId[]) {
  const errorsOfRow: Partial<Record<ValidatedColumnId, string>> = {}
  for (const columnId of columnIds) errorsOfRow[columnId] = clientValidators[columnId](row)
  return errorsOfRow
}

/** 全行・全列にクライアント検証をかけ、「行ID → 列ID → メッセージ」の形に索引付けする。 */
function validateRows(rows: TestRow[]): CellErrorIndex {
  return new Map(rows.map(row => [row.rowId, validateRow(row, VALIDATED_COLUMN_IDS)]))
}

/** 商品マスタ（サーバーだけが知っている情報のつもり）。値は在庫数。 */
const STOCK_MASTER: Record<string, number> = {
  りんご: 20,
  みかん: 50,
  ぶどう: 5,
  バナナ: 30,
  洗剤: 10,
  ティッシュ: 100,
}

/**
 * 擬似的なサーバー検証。実際のアプリケーションでは API 呼び出しにあたる部分。
 *
 * 行の値だけからは判断できない検証（マスタ照合・在庫チェック・営業日チェック）を行い、
 * どの行のどの項目が誤っているかを返す。
 * 返すエラーに行番号ではなく行のIDを含めておくのが要点。
 */
async function postToServer(rows: TestRow[]): Promise<ServerError[]> {
  await new Promise(resolve => setTimeout(resolve, 600)) // 通信待ちのつもり

  const errors: ServerError[] = []
  rows.forEach((row, rowIndex) => {
    const stock = row.name ? STOCK_MASTER[row.name] : undefined

    if (row.name && stock === undefined) {
      errors.push({ rowId: row.rowId, rowIndex, columnId: "name", message: `「${row.name}」は商品マスタに存在しません。` })
    } else if (stock !== undefined && (row.quantity ?? 0) > stock) {
      errors.push({ rowId: row.rowId, rowIndex, columnId: "quantity", message: `在庫が不足しています（在庫数: ${stock}）。` })
    }

    const deliveryDate = row.deliveryDate ? parseDate(row.deliveryDate) : undefined
    if (deliveryDate && (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6)) {
      errors.push({ rowId: row.rowId, rowIndex, columnId: "deliveryDate", message: "土日は休業日のため納品日に指定できません。" })
    }
  })
  return errors
}

/** YYYY-MM-DD 形式の文字列を日付にする。解釈できない場合は undefined */
function parseDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { rowId: "R1", name: "りんご", quantity: 10, unitPrice: 120, deliveryDate: "2026-09-18", note: "" },
    { rowId: "R2", name: "みかん", quantity: 60, unitPrice: 80, deliveryDate: "2026-09-19", note: "送信するとエラーになる" },
    { rowId: "R3", name: "ドラゴンフルーツ", quantity: 3, unitPrice: 900, deliveryDate: "2026-09-24", note: "送信するとエラーになる" },
    { rowId: "R4", name: "", quantity: 2, unitPrice: 250, deliveryDate: "", note: "最初からエラー" },
    { rowId: "R5", name: "ティッシュ", quantity: 0, unitPrice: 300, deliveryDate: "2026-09-25", note: "最初からエラー" },
    { rowId: "R6", name: "ぶどう", quantity: 5, unitPrice: 400, deliveryDate: "2026-09-21", note: "" },
  ]
}

/**
 * セル表示コンポーネント。
 *
 * エラーがある場合は枠線と背景色を変え、メッセージをツールチップで表示する。
 * エラーが無いときも透明な枠線を持たせておくことで、
 * エラーの有無でセルの中身の位置がずれないようにしている。
 */
function CellText({ children, error }: {
  children?: React.ReactNode
  error?: string
}) {
  return (
    <span
      title={error}
      className={`relative flex-1 min-w-0 px-1 py-px border text-sm truncate ${error
        ? "border-rose-600 text-rose-600"
        : "border-transparent"}`}
    >
      {children}
      {error && (
        // エラーであることを示すセル右上の赤い三角
        <span aria-hidden className="absolute top-0 right-0 border-4 border-transparent border-t-rose-600 border-r-rose-600" />
      )}
    </span>
  )
}

const storybookSetting: Meta<typeof CellErrorExample> = {
  title: "編集/セル単位のエラー表示",
  component: CellErrorExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const セル単位のエラー表示: StoryObj<typeof storybookSetting> = {}
