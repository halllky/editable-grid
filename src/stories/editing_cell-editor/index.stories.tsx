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

/**
 * セルエディタ実装指南
 */
function CellEditorExample() {

  const { control, setValue, getValues } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])

  const columns = React.useMemo((): EG2.EditableGrid2Column<TestRow>[] => [{
    columnId: "singleLine",
    // 改行なしテキスト エディタ用設定 ここから
    editor: SingleLineEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.singleLine`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => {
      // 改行コードが含まれた値がペーストされるなどに備え、改行除去したうえで設定する
      setValue(`rows.${rowIndex}.singleLine`, value.replace(/[\r\n\u2028\u2029]/g, ''))
    },
    // 改行なしテキスト エディタ用設定 ここまで

    renderHeader: () => <CellText>改行なし</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.singleLine`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 152,
  }, {
    columnId: "multiLine",
    // 改行ありテキスト エディタ用設定 ここから
    editor: MultiLineEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.multiLine`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.multiLine`, value),
    // 改行ありテキスト エディタ用設定 ここまで

    renderHeader: () => <CellText>改行あり（※1）</CellText>,
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.multiLine`, control })
      return <CellText wrap>{watched}</CellText>
    },
    defaultWidth: 224,
  }, {
    columnId: "option",
    // 選択肢（ドロップダウン） エディタ用設定 ここから
    editor: OptionEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.option`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.option`, value as TestRow["option"]),
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
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.option`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 120,
  }, {
    columnId: "date",
    // 日付 エディタ用設定 ここから
    editor: DateEditor,
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.date`) ?? "",
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.date`, value),
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
    renderBody: ({ rowIndex }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.date`, control })
      return <CellText>{watched}</CellText>
    },
    defaultWidth: 124,
  }, {
    columnId: "checkbox",
    // チェックボックス エディタ用設定 ここから
    // クリックだけで値を切り替えられるため、専用のセルエディタは持たない。
    // クリップボードとのコピーペーストのために get, set は定義しておく。
    getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.checkbox`) ? 'true' : 'false',
    setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.checkbox`, value.toLowerCase() === 'true'),
    onCellKeyDown: ({ rowIndex, event }) => {
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        const current = getValues(`rows.${rowIndex}.checkbox`)
        setValue(`rows.${rowIndex}.checkbox`, !current)
      }
    },
    // チェックボックス エディタ用設定 ここまで

    renderHeader: () => <CellText>チェックボックス（※3）</CellText>,
    renderBody: ({ rowIndex, isReadOnly }) => {
      const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.checkbox`, control })
      return (
        <label className={`flex items-start w-full h-full px-1 ${isReadOnly ? '' : 'cursor-pointer'}`}>
          <span>
            <input
              type="checkbox"
              checked={!!watched}
              onChange={e => setValue(`rows.${rowIndex}.checkbox`, e.target.checked)}
              disabled={isReadOnly}
              className={isReadOnly ? '' : 'cursor-pointer'}
            />
            &nbsp;
          </span>
        </label>
      )
    },
    defaultWidth: 188,
  }], [control, getValues, setValue])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={index => getValues(`rows.${index}`)}
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
