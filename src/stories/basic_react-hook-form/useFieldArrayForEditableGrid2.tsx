import React from "react"
import * as ReactHookForm from "react-hook-form"
import {
  createColumnHelper,
  EditableGrid2Column,
  EditableGrid2LeafColumn,
  EditableGrid2Props,
  EditableGrid2Ref,
  EditableGrid2RowUpdate,
  EditableGridCellEditor,
  EditableGridCellEditorProps,
  EditableGridCellEditorRef,
} from "../../EditableGrid2"
import { createTextCellEditor } from "../editing_cell-editor/createTextCellEditor"

// 文字列型セルのエディタ。参照を安定させるため、その場で作らずモジュールスコープの定数とする。
const TextEditor = createTextCellEditor(false)
const WrapTextEditor = createTextCellEditor(true)

/**
 * EditableGrid2 を react-hook-form の useFieldArray と組み合わせて使用する際の
 * 定型的な処理をまとめたカスタムフック。
 *
 * これは EditableGrid2 ライブラリ本体の一部ではなく、
 * react-hook-form と連携する際の実装例（Storybook 用）です。
 * 利用側のプロジェクトにこのファイルをコピーして使うか、
 * これを参考に同様のフックを自前で定義してください。
 *
 * @param getColumnDef 列定義を返す関数。
 * @param columnDeps getColumnDef の中で参照している外側の値（useMemo の依存配列と同じ扱い）。
 * 列定義はこれらの値が変わったときだけ再評価される。含め忘れると、その値が変わっても列定義内の関数は古い値を参照したままになる。
 */
export function useFieldArrayForEditableGrid2<
  TField extends ReactHookForm.FieldValues,
  TArrayPath extends ReactHookForm.ArrayPath<TField>,
  TKeyName extends string = 'id'
>(
  formProps: ReactHookForm.UseFieldArrayProps<TField, TArrayPath, TKeyName> & {
    getValues: ReactHookForm.UseFormGetValues<TField>
    setValue: ReactHookForm.UseFormSetValue<TField>
    subscribe: ReactHookForm.UseFormReturn<TField>["subscribe"]
  },
  getColumnDef: GetColumnDefWithHelper<ReactHookForm.FieldArrayWithId<TField, TArrayPath, TKeyName>>,
  columnDeps: React.DependencyList
) {
  type TRow = ReactHookForm.FieldArrayWithId<TField, TArrayPath, TKeyName>

  // react-hook-form
  const { getValues, setValue, subscribe, ...fieldArrayProps } = formProps
  const fieldArrayReturn = ReactHookForm.useFieldArray<TField, TArrayPath, TKeyName>(fieldArrayProps)
  const arrayName = fieldArrayProps.name

  // 列定義
  const gridRef = React.useRef<EditableGrid2Ref<TRow>>(null)
  const helper = useColumnDefHelper<TField, TArrayPath, TKeyName>(setValue, arrayName)
  // 列定義の参照を安定させるため、helper と columnDeps が変わったときだけ再評価する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = React.useMemo(() => getColumnDef(helper), [helper, ...columnDeps])

  // 行の並び。fields は行の追加・削除・並べ替えのときだけ変わり、値の最新状態は入っていないため、行のキーだけを取り出して使う。
  const rowKeyName = fieldArrayProps.keyName ?? "id"
  const rowKeys = React.useMemo(
    () => fieldArrayReturn.fields.map(f => (f as Record<string, string>)[rowKeyName]),
    [fieldArrayReturn.fields, rowKeyName]
  )

  // 配列の中の値が変わったことをグリッドに通知する。
  // グリッドの操作による変更も、グリッドの外からの setValue による変更も、どちらも通知される。
  const subscribeRows = React.useCallback((onChange: () => void) => subscribe({
    name: arrayName as ReactHookForm.Path<TField>,
    formState: { values: true },
    callback: onChange,
  }), [subscribe, arrayName])

  // グリッドの操作（編集確定・貼り付け・Delete）による変更を反映する。
  // setValue は1回ごとにフォーム全体を複製するため、セル単位ではなく行単位で呼ぶ。
  const handleRowsChange = React.useCallback((updates: EditableGrid2RowUpdate<TRow>[]) => {
    for (const { rowIndex, row } of updates) {
      setValue(
        `${arrayName}.${rowIndex}` as ReactHookForm.Path<TField>,
        row as ReactHookForm.PathValue<TField, ReactHookForm.Path<TField>>,
        { shouldDirty: true }
      )
    }
  }, [setValue, arrayName])

  // 行の最新の値を取得する関数。
  // レンダリングに使われる値はこの関数経由で取得される。
  const getLatestRowObject = React.useCallback((index: number) => {
    return getValues(`${arrayName}.${index}` as ReactHookForm.Path<TField>)
  }, [getValues, arrayName])

  // EditableGrid2 の props
  const editableGrid2Props: EditableGrid2Props<TRow> & { ref: React.RefObject<EditableGrid2Ref<TRow> | null> } = {
    ref: gridRef,
    rowKeys,
    columns,
    getLatestRowObject,
    subscribe: subscribeRows,
    onRowsChange: handleRowsChange,
  }

  return {
    fieldArrayReturn,
    editableGrid2Props,
    gridRef,
  }
}

export type UseFieldArrayForEditableGrid2Return<
  TField extends ReactHookForm.FieldValues,
  TArrayPath extends ReactHookForm.ArrayPath<TField>,
  TKeyName extends string
> = {
  /** useFieldArray の返り値 */
  fieldArrayReturn: ReactHookForm.UseFieldArrayReturn<TField, TArrayPath, TKeyName>
  /** EditableGrid2 の引数。スプレッド構文でそのまま渡すこと */
  editableGrid2Props: EditableGrid2Props<ReactHookForm.FieldArrayWithId<TField, TArrayPath, TKeyName>>
  /** グリッドの参照オブジェクト。EditableGrid2Ref 型として使用可能 */
  gridRef: React.RefObject<EditableGrid2Ref<ReactHookForm.FieldArrayWithId<TField, TArrayPath, TKeyName>>>
}

//#region 列定義ヘルパー

export type GetColumnDefWithHelper<TRow> = (helper: ColumnDefHelper<TRow>) => EditableGrid2Column<TRow>[]

/**
 * ヘルパーが返す列定義。
 * 列ごとに getValuesForRender の戻り値の型が異なるため、deps の型は any とする。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HelperLeafColumn<TRow> = EditableGrid2LeafColumn<TRow, any>

/** 列定義ヘルパー */
export type ColumnDefHelper<TRow> = {

  /** 文字列型。key にはドット区切りでネストしたプロパティも指定できる。 */
  textCell: (
    header: string,
    key: ReactHookForm.Path<TRow>,
    options?: Omit<Partial<HelperLeafColumn<TRow>>, 'wrap'> & {
      format?: (value: unknown) => string
      parse?: (value: string) => unknown
      /** 折り返し表示をするかどうか */
      wrap?: boolean
    }
  ) => HelperLeafColumn<TRow>

  /**
   * ボタン。key を持たないため columnId は明示必須。
   * text の戻り値が変わったときにボタンが描画し直される。
   */
  buttonCell: (
    text: (row: TRow, rowIndex: number) => React.ReactNode,
    onClick: (row: TRow, rowIndex: number) => void,
    options: Partial<HelperLeafColumn<TRow>> & {
      columnId: string
      disableIfReadOnly?: boolean
    }
  ) => HelperLeafColumn<TRow>

  /** 選択肢（ドロップダウン） */
  selectCell: (
    header: string,
    key: ReactHookForm.Path<TRow>,
    candidateValues: { value: string, text: string }[],
    options?: Partial<HelperLeafColumn<TRow>>
  ) => HelperLeafColumn<TRow>

  /** チェックボックス */
  booleanCell: (
    header: string,
    key: ReactHookForm.Path<TRow>,
    options?: Partial<HelperLeafColumn<TRow>>
  ) => HelperLeafColumn<TRow>
}

/** 列定義ヘルパーの実装 */
function useColumnDefHelper<
  TField extends ReactHookForm.FieldValues,
  TArrayPath extends ReactHookForm.ArrayPath<TField>,
  TKeyName extends string
>(
  setValue: ReactHookForm.UseFormSetValue<TField>,
  arrayName: TArrayPath,
): ColumnDefHelper<ReactHookForm.FieldArrayWithId<TField, TArrayPath, TKeyName>> {

  type TRow = ReactHookForm.FieldArrayWithId<TField, TArrayPath, TKeyName>

  // 列定義は依存配列（columnDeps）の値が変わるたびに再評価され、そのたびに selectCell も呼び直される。
  // 選択肢ごとにエディタコンポーネントを作る必要があるため、editor に渡す参照を安定させるよう
  // 一度作ったエディタコンポーネントをキャッシュして使い回す。
  const selectEditorCache = React.useRef(new Map<string, EditableGridCellEditor>()).current

  return React.useMemo(() => {
    const col = createColumnHelper<TRow>()

    /** セル内のコントロールから直接値を書き換えるときのパス */
    const cellPath = (rowIndex: number, key: string) => `${arrayName}.${rowIndex}.${key}` as ReactHookForm.Path<TField>

    const helper: ColumnDefHelper<TRow> = {

      //#region ヘルパー: 文字列型
      textCell: (header, key, options) => {
        const { wrap, format, parse, ...restOptions } = options ?? {}
        const formatValue = (value: unknown) => format?.(value) ?? (value as { toString?: () => string } | null | undefined)?.toString?.() ?? ''
        return col.leaf({
          columnId: String(key),
          editor: wrap ? WrapTextEditor : TextEditor,
          renderHeader: () => (
            <div className="px-1 py-px text-sm truncate text-gray-700">
              {header}
            </div>
          ),
          getValuesForRender: row => [getIn(row, key)],
          renderBody: ({ deps: [value] }) => (
            <div className={`px-1 py-px text-sm ${wrap ? 'whitespace-pre-wrap' : 'truncate'}`}>
              {formatValue(value)}
            </div>
          ),
          cellToText: row => formatValue(getIn(row, key)),
          textToCell: (row, text) => setIn(row, key, parse ? parse(text) : text),
          ...restOptions,
        })
      },
      //#endregion ヘルパー: 文字列型

      //#region ヘルパー: ボタン
      buttonCell: (text, onClick, options) => {
        const { disableIfReadOnly, ...restOptions } = options
        return col.leaf({
          renderHeader: () => null,
          // ボタンの文言が変わったときだけ描画し直す
          getValuesForRender: (row, rowIndex) => [text(row, rowIndex)],
          renderBody: ({ deps: [label], rowIndex, getRow, isReadOnly }) => (
            <button type="button"
              // クリック時点の最新の行を渡す
              onClick={() => onClick(getRow(), rowIndex)}
              disabled={disableIfReadOnly === true && isReadOnly}
              className="w-full h-full text-sm text-white bg-teal-700 border border-white"
            >
              {label}
            </button>
          ),
          disableResizing: true,
          ...restOptions,
        })
      },
      //#endregion ヘルパー: ボタン

      //#region ヘルパー: ドロップダウン
      selectCell: (header, key, candidateValues, options) => {
        const columnId = options?.columnId ?? String(key)

        // エディタコンポーネントの参照を安定させるため columnId ごとにキャッシュする。
        // （同じ columnId で candidateValues の内容が変わるケースは想定していない）
        let Editor = selectEditorCache.get(columnId)
        if (!Editor) Editor = React.forwardRef<EditableGridCellEditorRef, EditableGridCellEditorProps>((props, ref) => {
          const selectRef = React.useRef<HTMLSelectElement>(null)
          const [value, setVal] = React.useState('')

          const handleChange: React.ChangeEventHandler<HTMLSelectElement> = e => {
            props.requestCommit(e.target.value)
          }
          const handleClick: React.MouseEventHandler<HTMLSelectElement> = () => {
            if (props.isEditing) {
              props.requestCommit(selectRef.current?.value ?? '')
            }
          }
          const handleKeyDown: React.KeyboardEventHandler<HTMLSelectElement> = e => {
            // 編集をキャンセルする
            if (props.isEditing && e.key === 'Escape') {
              props.requestCancel()
              e.preventDefault()
            }
          }

          React.useImperativeHandle(ref, () => ({
            getCurrentValue: () => selectRef.current?.value ?? '',
            setValueAndSelectAll: (v, timing) => {
              setVal(v)
              setTimeout(() => {
                selectRef.current?.focus()
                if (timing === 'edit-start') selectRef.current?.showPicker?.()
              }, 0)
            },
            getDomElement: () => selectRef.current,
          }))

          return (
            <div style={props.style}>
              <select
                ref={selectRef}
                value={value}
                onChange={handleChange}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                className="w-full text-sm border border-black outline-none bg-white"
              >
                {candidateValues.map(c => (
                  <option key={c.value} value={c.value}>{c.text}</option>
                ))}
              </select>
            </div>
          )
        })
        selectEditorCache.set(columnId, Editor)

        return col.leaf({
          columnId,
          renderHeader: () => (
            <div className="px-1 py-px text-sm truncate text-gray-700">
              {header}
            </div>
          ),
          getValuesForRender: row => [getIn(row, key)],
          renderBody: ({ deps: [value] }) => (
            <div className="px-1 py-px truncate text-sm">
              {candidateValues.find(o => o.value === value)?.text ?? (value as string)}
            </div>
          ),
          editor: Editor,
          cellToText: row => (getIn(row, key) as string | undefined) ?? '',
          textToCell: (row, text) => setIn(row, key, text),
          onCellKeyDown: ({ event, requestEditStart }) => {
            const alt = event.altKey || event.metaKey
            const upDown = event.key === 'ArrowUp' || event.key === 'ArrowDown'
            if (event.key === 'Enter' || alt && upDown) {
              requestEditStart()
              event.preventDefault()
            }
          },
          ...options,
        })
      },
      //#endregion ヘルパー: ドロップダウン

      //#region ヘルパー: チェックボックス
      booleanCell: (header, key, options) => col.leaf({
        columnId: String(key),
        renderHeader: () => (
          <div className="px-1 py-px text-sm truncate text-gray-700">
            {header}
          </div>
        ),
        getValuesForRender: row => [!!getIn(row, key)],
        renderBody: ({ deps: [checked], rowIndex, isReadOnly }) => (
          <label className={`self-start block h-full w-full px-1 ${isReadOnly ? '' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={checked}
              // セル内のコントロールからの変更はグリッドを経由せず直接反映する（subscribe でグリッドに通知される）
              onChange={e => setValue(
                cellPath(rowIndex, key),
                e.target.checked as ReactHookForm.PathValue<TField, ReactHookForm.Path<TField>>,
                { shouldDirty: true }
              )}
              disabled={isReadOnly}
              className="block h-6"
            />
          </label>
        ),
        onCellKeyDown: ({ row, rowIndex, event }) => {
          if (event.key === ' ' || event.code === 'Space') {
            event.preventDefault()
            setValue(
              cellPath(rowIndex, key),
              !getIn(row, key) as ReactHookForm.PathValue<TField, ReactHookForm.Path<TField>>,
              { shouldDirty: true }
            )
          }
        },
        cellToText: row => getIn(row, key) ? 'true' : 'false',
        textToCell: (row, text) => setIn(row, key, ['true', '1', 'yes'].includes(text.trim().toLowerCase())),
        ...options,
      }),
      //#endregion ヘルパー: チェックボックス
    }
    return helper
  }, [setValue, arrayName, selectEditorCache])
}

/** ドット区切りのパスの位置にある値を取得する */
function getIn(obj: unknown, path: string): unknown {
  let current = obj
  for (const key of path.split('.')) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * ドット区切りのパスの位置に値を設定した新しいオブジェクトを返す。
 * 引数のオブジェクトは書き換えない（パス上のオブジェクトだけを複製し、それ以外は共有する）。
 */
function setIn<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.')
  const current = (obj ?? {}) as Record<string, unknown>
  const copy: Record<string, unknown> = Array.isArray(current) ? [...current] as unknown as Record<string, unknown> : { ...current }
  copy[head] = rest.length === 0 ? value : setIn(current[head], rest.join('.'), value)
  return copy as T
}

//#endregion 列定義ヘルパー
