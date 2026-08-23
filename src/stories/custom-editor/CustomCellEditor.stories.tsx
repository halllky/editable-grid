import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "./createTextCellEditor"
import { createSelectCellEditor } from "./createSelectCellEditor"

/**
 * セルエディタ実装指南
 */
function CellEditorExample() {

  const { control, setValue, getValues } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })

  return (
    <EG2.EditableGrid2
      data={fields}
      columns={[() => [{
        // 改行なしテキスト エディタ用設定 ここから
        editor: createTextCellEditor(),
        getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.singleLine`) ?? "",
        setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.singleLine`, value),
        // 改行なしテキスト エディタ用設定 ここまで

        renderHeader: () => <CellText>改行なしのテキスト</CellText>,
        renderBody: ({ context }) => {
          const watched = ReactHookForm.useWatch({ name: `rows.${context.row.index}.singleLine`, control })
          return <CellText>{watched}</CellText>
        },
        defaultWidth: 152,
      }, {
        // 改行ありテキスト エディタ用設定 ここから
        wrap: true,
        editor: createTextCellEditor(),
        getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.multiLine`) ?? "",
        setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.multiLine`, value),
        // 改行ありテキスト エディタ用設定 ここまで

        renderHeader: () => <CellText>改行あり</CellText>,
        renderBody: ({ context }) => {
          const watched = ReactHookForm.useWatch({ name: `rows.${context.row.index}.multiLine`, control })
          return <CellText break>{watched}</CellText>
        },
        defaultWidth: 196,
      }, {
        // 選択肢（ドロップダウン） エディタ用設定 ここから
        editor: createSelectCellEditor(["円", "ドル", "ユーロ"] satisfies TestRow["option"][]),
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

        renderHeader: () => <CellText>選択肢</CellText>,
        renderBody: ({ context }) => {
          const watched = ReactHookForm.useWatch({ name: `rows.${context.row.index}.option`, control })
          return <CellText>{watched}</CellText>
        },
        defaultWidth: 120,
      }, {
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

        renderHeader: () => <CellText>チェックボックス</CellText>,
        renderBody: ({ context, isReadOnly }) => {
          const watched = ReactHookForm.useWatch({ name: `rows.${context.row.index}.checkbox`, control })
          return (
            <label className={`flex items-start w-full h-full px-1 ${isReadOnly ? '' : 'cursor-pointer'}`}>
              <span>
                <input
                  type="checkbox"
                  checked={!!watched}
                  onChange={e => setValue(`rows.${context.row.index}.checkbox`, e.target.checked)}
                  disabled={isReadOnly}
                  className={isReadOnly ? '' : 'cursor-pointer'}
                />
                &nbsp;
              </span>
            </label>
          )
        },
        defaultWidth: 120,
      }], [control, getValues, setValue]]}
      className="resize-y border border-gray-300"
    />
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  singleLine?: string
  multiLine?: string
  option?: "円" | "ドル" | "ユーロ"
  checkbox?: boolean
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return Array.from({ length: 3 }).map((_, i) => ({
    rowId: i.toFixed(),
    singleLine: "改行なしのテキスト",
    multiLine: "1行目1行目1行目1行目1行目\n2行目2行目2行目2行目2行目",
    option: "円",
  }))
}

/** セルの基本的スタイルを施したもの */
function CellText(props: { break?: boolean, children?: React.ReactNode }) {

  const className = props.break
    ? "py-px px-1 border border-transparent text-sm whitespace-pre-wrap"
    : "py-px px-1 border border-transparent text-sm truncate"

  return (
    <span className={className}>
      {props.children}
    </span>
  )
}

const storybookSetting: Meta<typeof CellEditorExample> = {
  title: "EditableGrid2/編集",
  component: CellEditorExample,
}

export default storybookSetting

export const セルエディタ: StoryObj<typeof storybookSetting> = {}
