import React from "react"
import { EditableGridCellEditor } from "../../EditableGrid"

/**
 * 選択肢（ドロップダウン）セルエディタを作成する。
 *
 * EditableGrid はセルエディタを標準搭載していないため、
 * <select> による選択式編集の実装例としてここに置いている。
 * 利用側のプロジェクトにこのファイルをコピーして使うか、
 * これを参考に EditableGridCellEditor の契約を満たす自前のエディタを実装してください。
 * 
 * @param options 選択肢
 */
export function createSelectCellEditor(options: string[]): EditableGridCellEditor {

  return React.forwardRef(function SelectCellEditor({ style, isEditing, requestCommit, requestCancel }, ref) {

    const [value, setValue] = React.useState('')
    const selectRef = React.useRef<HTMLSelectElement>(null)

    const handleChange: React.ChangeEventHandler<HTMLSelectElement> = e => {
      // 選択肢は選ばれた時点で確定させてよい
      requestCommit(e.target.value)
    }

    // エディタ内部のキー操作
    const handleKeyDown: React.KeyboardEventHandler<HTMLSelectElement> = e => {
      // 編集をキャンセルする
      if (isEditing && e.key === 'Escape') {
        requestCancel()
        e.preventDefault()
      }
    }

    React.useImperativeHandle(ref, () => ({
      getCurrentValue: () => selectRef.current?.value ?? '',
      setValueAndSelectAll: (value, timing) => {
        setValue(value)
        setTimeout(() => {
          selectRef.current?.focus()
          if (timing === 'edit-start') selectRef.current?.showPicker?.()
        }, 0)
      },
      getDomElement: () => selectRef.current,
    }), [selectRef])

    return (
      <div style={style} className="leading-none">
        <select
          ref={selectRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="text-sm border border-black outline-none bg-white"
          style={{ minWidth: style.width }}
        >
          {options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    )
  })

}