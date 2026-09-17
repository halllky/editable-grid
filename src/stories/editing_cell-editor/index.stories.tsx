import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "./createTextCellEditor"
import { createSelectCellEditor } from "./createSelectCellEditor"
import { createDateCellEditor } from "./createDateCellEditor"

// editor が別のコンポーネント型にならないよう、
// その場で作らずモジュールスコープの定数として参照を安定させる。
const SingleLineEditor = createTextCellEditor(false)
const MultiLineEditor = createTextCellEditor(true)
const OptionEditor = createSelectCellEditor(["円", "ドル", "ユーロ"] satisfies TestRow["option"][])
const DateEditor = createDateCellEditor()

// 列定義の型推論の補助（getValuesForRender の戻り値の型が renderBody の deps に引き継がれる）
const col = EG2.createColumnHelper<TestRow>()

/**
 * セルエディタ実装指南
 */
function CellEditorExample() {

  const { control, setValue, getValues, subscribe } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])
  const getLatestRowObject = React.useCallback((index: number) => getValues(`rows.${index}`), [getValues])

  // React Hook Form の値が変わったことをグリッドに通知する
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: "rows",
    formState: { values: true },
    callback: onChange,
  }), [subscribe])

  // グリッドの操作（編集・貼り付け・Delete）による変更を React Hook Form に反映する
  const handleRowsChange = React.useCallback((updates: EG2.EditableGrid2RowUpdate<TestRow>[]) => {
    for (const { rowIndex, row } of updates) setValue(`rows.${rowIndex}`, row)
  }, [setValue])

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [col.leaf({
    columnId: "singleLine",
    // 改行なしテキスト エディタ用設定 ここから
    editor: SingleLineEditor,
    cellToText: row => row.singleLine ?? "",
    // 改行コードが含まれた値がペーストされるなどに備え、改行除去したうえで設定する
    textToCell: (row, text) => ({ ...row, singleLine: text.replace(/[\r\n\u2028\u2029]/g, '') }),
    // 改行なしテキスト エディタ用設定 ここまで

    renderHeader: () => <CellText>改行なし</CellText>,
    getValuesForRender: row => [row.singleLine],
    renderBody: ({ deps: [singleLine] }) => <CellText>{singleLine}</CellText>,
    defaultWidth: 152,
  }), col.leaf({
    columnId: "multiLine",
    // 改行ありテキスト エディタ用設定 ここから
    editor: MultiLineEditor,
    cellToText: row => row.multiLine ?? "",
    textToCell: (row, text) => ({ ...row, multiLine: text }),
    // 改行ありテキスト エディタ用設定 ここまで

    renderHeader: () => <CellText>改行あり（※1）</CellText>,
    getValuesForRender: row => [row.multiLine],
    renderBody: ({ deps: [multiLine] }) => <CellText wrap>{multiLine}</CellText>,
    defaultWidth: 224,
  }), col.leaf({
    columnId: "option",
    // 選択肢（ドロップダウン） エディタ用設定 ここから
    editor: OptionEditor,
    cellToText: row => row.option ?? "",
    textToCell: (row, text) => ({ ...row, option: text as TestRow["option"] }),
    onCellKeyDown: ({ event, requestEditStart }) => {
      const alt = event.altKey || event.metaKey
      const upDown = event.key === 'ArrowUp' || event.key === 'ArrowDown'
      if (event.key === 'Enter' || alt && upDown) {
        requestEditStart()
        event.preventDefault()
      }
    },
    // 選択肢（ドロップダウン） エディタ用設定 ここまで

    renderHeader: () => <CellText>選択肢（※2）</CellText>,
    getValuesForRender: row => [row.option],
    renderBody: ({ deps: [option] }) => <CellText>{option}</CellText>,
    defaultWidth: 120,
  }), col.leaf({
    columnId: "date",
    // 日付 エディタ用設定 ここから
    editor: DateEditor,
    cellToText: row => row.date ?? "",
    textToCell: (row, text) => ({ ...row, date: text }),
    onCellKeyDown: ({ event, requestEditStart }) => {
      const alt = event.altKey || event.metaKey
      const upDown = event.key === 'ArrowUp' || event.key === 'ArrowDown'
      if (event.key === 'Enter' || alt && upDown) {
        requestEditStart()
        event.preventDefault()
      }
    },
    // 日付 エディタ用設定 ここまで

    renderHeader: () => <CellText>日付（※2）</CellText>,
    getValuesForRender: row => [row.date],
    renderBody: ({ deps: [date] }) => <CellText>{date}</CellText>,
    defaultWidth: 124,
  }), col.leaf({
    columnId: "checkbox",
    // チェックボックス エディタ用設定 ここから
    // クリックだけで値を切り替えられるため、専用のセルエディタは持たない。
    // クリップボードとのコピーペーストのために cellToText, textToCell は定義しておく。
    cellToText: row => row.checkbox ? 'true' : 'false',
    textToCell: (row, text) => ({ ...row, checkbox: text.toLowerCase() === 'true' }),
    onCellKeyDown: ({ row, rowIndex, event }) => {
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        setValue(`rows.${rowIndex}.checkbox`, !row.checkbox)
      }
    },
    // チェックボックス エディタ用設定 ここまで

    renderHeader: () => <CellText>チェックボックス（※3）</CellText>,
    getValuesForRender: row => [!!row.checkbox],
    renderBody: ({ deps: [checked], rowIndex, isReadOnly }) => (
      <label className={`flex items-start w-full h-full px-1 ${isReadOnly ? '' : 'cursor-pointer'}`}>
        <span>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setValue(`rows.${rowIndex}.checkbox`, e.target.checked)}
            disabled={isReadOnly}
            className={isReadOnly ? '' : 'cursor-pointer'}
          />
          &nbsp;
        </span>
      </label>
    ),
    defaultWidth: 188,
  })], [setValue])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={getLatestRowObject}
        subscribe={subscribeRows}
        onRowsChange={handleRowsChange}
        columns={columns}
        className="border border-gray-500 resize-y"
      />
      <ul className="text-sm">
        <li>※1：エディタ内で Shift + Enter で改行可能</li>
        <li>※2：ここではHTML標準のドロップダウンや日付ピッカーを使用している。使用感が気になる場合はこの例を参考にせず利用側で独自に作りこむこと。</li>
        <li>※3：セルエディタなしの例。スペースキーやクリックで値をトグルできる。</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  singleLine?: string
  multiLine?: string
  option?: "円" | "ドル" | "ユーロ"
  checkbox?: boolean
  date?: string
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return Array.from({ length: 3 }).map((_, i) => ({
    rowId: i.toFixed(),
    singleLine: "改行なしのテキスト",
    multiLine: "1行目1行目1行目1行目1行目\n2行目2行目2行目2行目2行目",
    option: "円",
    date: "2024-01-01",
  }))
}

/** セルの基本的スタイルを施したもの */
function CellText(props: { wrap?: boolean, children?: React.ReactNode }) {

  const className = props.wrap
    ? "px-1 py-px border border-transparent text-sm truncate whitespace-pre-wrap"
    : "px-1 py-px border border-transparent text-sm truncate"

  return (
    <span className={className}>
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof CellEditorExample> = {
  title: "編集/セルエディタ",
  component: CellEditorExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const セルエディタ: StoryObj<typeof storybookSetting> = {}
