import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const TextEditor = createTextCellEditor(false)

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

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
 *   保持するとき何をキーに行と結び付けるかが、
 *   その後の行の挿入・入れ替えでエラーが正しい行に付いたままかどうかを左右する。
 */
function CellErrorExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields, insert, swap, remove, replace } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const gridRef = React.useRef<EG2.EditableGrid2Ref<TestRow>>(null)
  const getLatestRowObject = React.useCallback((index: number) => getValues(`rows.${index}`), [getValues])

  // React Hook Form の値が変わったことをグリッドに通知する
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: "rows",
    formState: { values: true },
    callback: onChange,
  }), [subscribe])

  // クライアント検証の結果。行のIDをキーに保持する。
  // 行の値から導出できるので描画のたびに計算することもできるが、それだと
  // 行を追加した直後、まだ何も入力していないセルがいきなりエラーになってしまう。
  const [clientErrors, setClientErrors] = React.useState<CellErrorIndex>(() => new Map())

  // サーバー検証の結果。行の値からは導出できないエラーなので、利用側で保持する必要がある。
  const [serverErrors, setServerErrors] = React.useState<ServerError[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // サーバーエラーをどのキーで行に結び付けるか。
  // 行番号（rowIndex）で結び付けると、行の挿入・入れ替えの後にエラーが別の行に付いたままになる。
  const [errorKeyMode, setErrorKeyMode] = React.useState<ErrorKeyMode>("rowId")

  // 画面初期表示時のクライアント検証。全行・全列にかける。
  // すでに保存されている不正なデータは、利用者が触る前から見えていてほしいため。
  React.useEffect(() => {
    setClientErrors(validateRows(getValues("rows")))
  }, [getValues])

  // サーバーエラーを「行のキー → 列ID → メッセージ」の形に組み替えたもの。
  // セルの描画のたびにエラーの配列を走査すると行数×列数のコストがかかるため、ここで1回だけ索引を作る。
  const serverErrorIndex = React.useMemo((): CellErrorIndex => {
    const index = new Map<string, Partial<Record<ValidatedColumnId, string>>>()
    for (const error of serverErrors) {
      const key = errorKeyMode === "rowId" ? error.rowId : String(error.rowIndex)
      const errorsOfRow = index.get(key) ?? {}
      errorsOfRow[error.columnId] = error.message
      index.set(key, errorsOfRow)
    }
    return index
  }, [serverErrors, errorKeyMode])

  // そのセルに表示するエラーメッセージを返す関数。
  // クライアント検証を優先し、そちらが通っている場合だけサーバー検証の結果を見る。
  const getCellError = React.useCallback((
    row: TestRow,
    rowIndex: number,
    columnId: ValidatedColumnId,
  ): string | undefined => {
    const serverErrorKey = errorKeyMode === "rowId" ? row.rowId : String(rowIndex)
    return clientErrors.get(row.rowId)?.[columnId] ?? serverErrorIndex.get(serverErrorKey)?.[columnId]
  }, [clientErrors, serverErrorIndex, errorKeyMode])

  // グリッドの操作（編集・貼り付け・Delete）による変更を React Hook Form に反映する。
  // あわせて、値が変わったセルのエラーを付け直す。
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    for (const { rowIndex, row } of updates) setValue(`rows.${rowIndex}`, row)

    // セル編集時のクライアント検証。
    // fromText がかかった列（changedColumnIds）だけを検証し直す。
    // 行全体を検証してしまうと、編集していない隣の未入力のセルまでエラーになる。
    // 検証の対象の列が1つも変わっていない場合は、
    // 無駄な再描画を避けるために state を作り替えず prev をそのまま返す。
    setClientErrors(prev => {
      let next: Map<string, Partial<Record<ValidatedColumnId, string>>> | undefined
      for (const { row, changedColumnIds } of updates) {
        const columnIds = changedColumnIds.filter(isValidatedColumnId)
        if (columnIds.length === 0) continue
        next ??= new Map(prev)
        next.set(row.rowId, { ...next.get(row.rowId), ...validateRow(row, columnIds) })
      }
      return next ?? prev
    })

    // 値が変わったセルに付いていたサーバーエラーを取り下げる。
    // サーバーエラーは「送信した時点の値」に対する指摘なので、値が変わった時点で古い情報になるため。
    setServerErrors(prev => prev.filter(error => !updates.some(update => (
      (errorKeyMode === "rowId" ? update.row.rowId === error.rowId : update.rowIndex === error.rowIndex)
      && update.changedColumnIds.includes(error.columnId)
    ))))
  }, [setValue, errorKeyMode])

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

  // 行の挿入。エラーが行に付いたままになるかどうかを確認するためのもの。
  // 挿入された行はまだ検証にかけないため、未入力のセルがいきなりエラーになることはない。
  const nextRowId = React.useRef(100)
  const insertRow = () => {
    insert(0, { rowId: `R${nextRowId.current++}`, name: "", note: "" })
  }

  // データを初期状態に戻す。画面初期表示時と同じく、全行・全列を検証し直す。
  const resetRows = () => {
    const rows = getDefaultValues()
    replace(rows)
    setClientErrors(validateRows(rows))
    setServerErrors([])
  }

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
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
    toText: row => row.name ?? "",
    fromText: (row, text) => ({ ...row, name: text }),
    renderHeader: () => <CellText>商品名</CellText>,

    // エラーメッセージも deps に含める。
    // 含めない場合、値が変わっていないのにエラーだけが変わったときにセルの表示が古いままになる。
    getValuesForRender: (row, rowIndex) => [row.name, getCellError(row, rowIndex, "name")],

    // セルの中身を描き分けるだけ。グリッド側の仕組みは何も使っていない。
    renderBody: ({ deps: [name, error] }) => <CellText error={error}>{name}</CellText>,
    defaultWidth: 148,
    // 商品名（クライアント検証＋サーバー検証） ここまで
  }), col.leaf({
    columnId: "quantity",
    editor: TextEditor,
    toText: row => String(row.quantity ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, quantity: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, quantity: parsed } : undefined
    },
    renderHeader: () => <CellText>数量</CellText>,
    getValuesForRender: (row, rowIndex) => [row.quantity, getCellError(row, rowIndex, "quantity")],
    renderBody: ({ deps: [quantity, error] }) => <CellText error={error}>{quantity}</CellText>,
    defaultWidth: 88,
  }), col.leaf({
    columnId: "unitPrice",
    editor: TextEditor,
    toText: row => String(row.unitPrice ?? ""),
    fromText: (row, text) => {
      if (text.trim() === "") return { ...row, unitPrice: undefined }
      const parsed = Number(text)
      return Number.isFinite(parsed) ? { ...row, unitPrice: parsed } : undefined
    },
    renderHeader: () => <CellText>単価</CellText>,
    getValuesForRender: (row, rowIndex) => [row.unitPrice, getCellError(row, rowIndex, "unitPrice")],
    renderBody: ({ deps: [unitPrice, error] }) => <CellText error={error}>{unitPrice}</CellText>,
    defaultWidth: 88,
  }), col.leaf({
    columnId: "deliveryDate",
    editor: TextEditor,
    toText: row => row.deliveryDate ?? "",
    fromText: (row, text) => ({ ...row, deliveryDate: text.trim() }),
    renderHeader: () => <CellText>納品日</CellText>,
    getValuesForRender: (row, rowIndex) => [row.deliveryDate, getCellError(row, rowIndex, "deliveryDate")],
    renderBody: ({ deps: [deliveryDate, error] }) => <CellText error={error}>{deliveryDate}</CellText>,
    defaultWidth: 116,
  }), col.leaf({
    // 検証の対象外の列。エラーが無い列では特別なことは何もしない。
    columnId: "note",
    editor: TextEditor,
    toText: row => row.note ?? "",
    fromText: (row, text) => ({ ...row, note: text }),
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
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-2 border border-gray-500 bg-white cursor-pointer disabled:text-gray-400 disabled:cursor-default"
        >
          {isSubmitting ? "サーバーに送信中..." : "サーバーに送信して検証する"}
        </button>
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

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>サーバーエラーと行の結び付け方：</span>
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input
            type="radio"
            name="errorKeyMode"
            checked={errorKeyMode === "rowId"}
            onChange={() => setErrorKeyMode("rowId")}
            className="cursor-pointer"
          />
          行ID（正しい）
        </label>
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input
            type="radio"
            name="errorKeyMode"
            checked={errorKeyMode === "rowIndex"}
            onChange={() => setErrorKeyMode("rowIndex")}
            className="cursor-pointer"
          />
          行番号（行の挿入・入れ替えで壊れる）
        </label>
      </div>

      <EG2.EditableGrid2
        ref={gridRef}
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="h-64 border border-gray-500 resize-y"
      />

      <ErrorSummary
        control={control}
        getCellError={getCellError}
        onJump={rowIndex => gridRef.current?.selectRow(rowIndex, rowIndex)}
      />
    </div>
  )
}

/**
 * グリッドの外に出すエラーの一覧。
 *
 * メッセージは行ごとにまとめる。1件を1行にして並べると、
 * 未入力の行が1つあるだけで一覧が何行にも膨らみ、何行目に問題があるのかが読み取りにくくなるため。
 *
 * グリッド本体を巻き込んで再描画させないよう、行の値の購読はこのコンポーネントの中だけで行う。
 * 一覧は「現在の行」から組み立てるため、行が削除されればその行のエラーは自然に消える
 * （エラーを保持している state に残っていても、対応する行が無ければ一覧にも出てこない）。
 */
function ErrorSummary({ control, getCellError, onJump }: {
  control: ReactHookForm.Control<{ rows: TestRow[] }>
  getCellError: CellErrorGetter
  onJump: (rowIndex: number) => void
}) {
  const rows = ReactHookForm.useWatch({ control, name: "rows" })

  const errorsByRow = React.useMemo(() => rows.flatMap((row, rowIndex) => {
    const messages = VALIDATED_COLUMN_IDS
      .map(columnId => getCellError(row, rowIndex, columnId))
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
type CellErrorGetter = (row: TestRow, rowIndex: number, columnId: ValidatedColumnId) => string | undefined

/** サーバーエラーを行に結び付けるキーの種類 */
type ErrorKeyMode = "rowId" | "rowIndex"

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
 * セルの基本的スタイルを施したもの。
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
        ? "border-rose-600 bg-rose-100 text-rose-900"
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
