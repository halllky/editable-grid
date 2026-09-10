import React from "react"
import * as ReactHookForm from "react-hook-form"
import * as EG2 from "../../EditableGrid2"
import { Meta, StoryObj } from "@storybook/react-vite"
import { createTextCellEditor } from "../cell-editor/createTextCellEditor"
import { createSelectCellEditor } from "../cell-editor/createSelectCellEditor"

// 列定義は毎レンダリング評価されるため、editor に渡すコンポーネントは
// その場で作らずモジュールスコープの定数として参照を安定させる（セルエディタの実装自体は
// 「セルエディタ」のページのものをそのまま import して使い回している）。
const NameEditor = createTextCellEditor(false)
const NoteEditor = createTextCellEditor(true)
const CategoryEditor = createSelectCellEditor(["食品", "日用品", "その他"] satisfies TestRow["category"][])

/**
 * コピー＆ペースト実演画面。
 *
 * コピー＆ペーストを有効にするための専用のプロパティは無く、
 * 下記の各列のように getValueForEditor / setValueFromEditor を定義した列は
 * 自動的にクリップボードとの相互コピペの対象になる。
 */
function CopyPasteExample() {

  const { control, setValue, getValues } = ReactHookForm.useForm<{ rows: TestRow[] }>({
    defaultValues: { rows: getDefaultValues() },
  })
  const { fields } = ReactHookForm.useFieldArray({ name: "rows", control })
  const rowKeys = React.useMemo(() => fields.map(f => f.id), [fields])

  return (
    <div className="flex flex-col gap-2 p-2">
      <EG2.EditableGrid2
        rowKeys={rowKeys}
        getLatestRowObject={index => getValues(`rows.${index}`)}
        columns={[{
          columnId: "name",
          // 商品名 エディタ用設定 ここから
          // もっとも基本的なコピペ対象列。
          editor: NameEditor,
          getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.name`) ?? "",
          setValueFromEditor: ({ rowIndex, value }) => {
            // コピペのロジックは自由に定義できる。
            // ここでは改行コードが含まれた値がペーストされるなどに備え、改行除去したうえで設定している。
            setValue(`rows.${rowIndex}.name`, value.replace(/[\r\n\u2028\u2029]/g, ''))
          },
          // 商品名 エディタ用設定 ここまで

          renderHeader: () => <CellText>商品名</CellText>,
          renderBody: ({ rowIndex }) => {
            const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.name`, control })
            return <CellText>{watched}</CellText>
          },
          defaultWidth: 160,
        }, {
          columnId: "unitPrice",
          // 単価 エディタ用設定 ここから
          // クリップボードから渡ってくる値は常に文字列なので、数値列でも自前でパースする必要がある。
          // パースできない文字列が貼り付けられた場合は無視して元の値を保つ。
          editor: NameEditor,
          getValueForEditor: ({ rowIndex }) => String(getValues(`rows.${rowIndex}.unitPrice`) ?? ""),
          setValueFromEditor: ({ rowIndex, value }) => {
            if (value.trim() === "") {
              setValue(`rows.${rowIndex}.unitPrice`, undefined)
            } else {
              const parsed = Number(value)
              if (!Number.isFinite(parsed)) return
              setValue(`rows.${rowIndex}.unitPrice`, parsed)
            }
          },
          // 単価 エディタ用設定 ここまで

          renderHeader: () => <CellText>単価（※1）</CellText>,
          renderBody: ({ rowIndex }) => {
            const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.unitPrice`, control })
            return <CellText>{watched}</CellText>
          },
          defaultWidth: 96,
        }, {
          columnId: "quantity",
          // 数量 エディタ用設定 ここから
          editor: NameEditor,
          getValueForEditor: ({ rowIndex }) => String(getValues(`rows.${rowIndex}.quantity`) ?? ""),
          setValueFromEditor: ({ rowIndex, value }) => {
            if (value.trim() === "") {
              setValue(`rows.${rowIndex}.quantity`, undefined)
            } else {
              const parsed = Number(value)
              if (!Number.isFinite(parsed)) return
              setValue(`rows.${rowIndex}.quantity`, parsed)
            }
          },
          // 数量 エディタ用設定 ここまで

          renderHeader: () => <CellText>数量（※1）</CellText>,
          renderBody: ({ rowIndex }) => {
            const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.quantity`, control })
            return <CellText>{watched}</CellText>
          },
          defaultWidth: 96,
        }, {
          columnId: "amount",
          // 金額（読み取り専用・計算列） ここから
          // getValueForEditor だけを定義し setValueFromEditor を定義しないことで、
          // 「コピーはできるがペーストは常にスキップされる列」になる。
          // isReadOnly も併せて true にしているため、Delete キーでのクリアもスキップされる。
          isReadOnly: true,
          getValueForEditor: ({ rowIndex }) => {
            const row = getValues(`rows.${rowIndex}`)
            return String((row.unitPrice ?? 0) * (row.quantity ?? 0))
          },
          // 金額（読み取り専用・計算列） ここまで

          renderHeader: () => <CellText>金額（※2）</CellText>,
          renderBody: ({ rowIndex }) => {
            const unitPrice = ReactHookForm.useWatch({ name: `rows.${rowIndex}.unitPrice`, control })
            const quantity = ReactHookForm.useWatch({ name: `rows.${rowIndex}.quantity`, control })
            return <CellText>{(unitPrice ?? 0) * (quantity ?? 0)}</CellText>
          },
          defaultWidth: 96,
        }, {
          columnId: "category",
          // 区分 エディタ用設定 ここから
          // 選択肢に無い文字列が貼り付けられた場合は無視することで、
          // 型として許容されない値がセルに入り込むのを防いでいる。
          editor: CategoryEditor,
          getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.category`) ?? "",
          setValueFromEditor: ({ rowIndex, value }) => {
            if (value.trim() === "") {
              setValue(`rows.${rowIndex}.category`, undefined)

            } else if ((["食品", "日用品", "その他"] as const).includes(value as NonNullable<TestRow["category"]>)) {
              setValue(`rows.${rowIndex}.category`, value as NonNullable<TestRow["category"]>)
            }
          },
          // 区分 エディタ用設定 ここまで

          renderHeader: () => <CellText>区分（※3）</CellText>,
          renderBody: ({ rowIndex }) => {
            const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.category`, control })
            return <CellText>{watched}</CellText>
          },
          defaultWidth: 96,
        }, {
          columnId: "note",
          // 備考（改行あり） エディタ用設定 ここから
          // セル内に改行を含められる列。TSV上はダブルクォートで囲まれた1セルとして
          // 表現されるため、Excel との間で改行込みのまま相互にコピペできる。
          editor: NoteEditor,
          getValueForEditor: ({ rowIndex }) => getValues(`rows.${rowIndex}.note`) ?? "",
          setValueFromEditor: ({ rowIndex, value }) => setValue(`rows.${rowIndex}.note`, value),
          // 備考（改行あり） エディタ用設定 ここまで

          renderHeader: () => <CellText>備考（※4）</CellText>,
          renderBody: ({ rowIndex }) => {
            const watched = ReactHookForm.useWatch({ name: `rows.${rowIndex}.note`, control })
            return <CellText wrap>{watched}</CellText>
          },
          defaultWidth: 200,
        }]}
        className="border border-gray-500 resize-y"
      />
      <ul className="text-sm">
        <li>※1：数字のみ貼り付け可能</li>
        <li>※2：読み取り専用の計算列。コピーはできるがペーストは常にスキップされる</li>
        <li>※3：ドロップダウンで選択できる値のみ貼り付け可能</li>
        <li>※4：改行つき文字列。コピー時にダブルクォーテーションで囲まれます。</li>
      </ul>
    </div>
  )
}

/** データ1行分 */
type TestRow = {
  rowId: string
  name?: string
  unitPrice?: number
  quantity?: number
  category?: "食品" | "日用品" | "その他"
  note?: string
}

/** この画面のデフォルトデータ */
function getDefaultValues(): TestRow[] {
  return [
    { rowId: "0", name: "りんご", unitPrice: 120, quantity: 3, category: "食品", note: "" },
    { rowId: "1", name: "みかん", unitPrice: 80, quantity: 10, category: "食品", note: "箱買い\n家族用" },
    { rowId: "2", name: "ぶどう", unitPrice: 400, quantity: 2, category: "食品", note: "" },
    { rowId: "3", name: "洗剤", unitPrice: 250, quantity: 1, category: "日用品", note: "" },
    { rowId: "4", name: "ティッシュ", unitPrice: 300, quantity: 5, category: "日用品", note: "" },
  ]
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

const storybookSetting: Meta<typeof CopyPasteExample> = {
  title: "コピー＆ペースト",
  component: CopyPasteExample,
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const コピーアンドペースト: StoryObj<typeof storybookSetting> = {}
