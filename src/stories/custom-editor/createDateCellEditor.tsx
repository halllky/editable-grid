import React from "react"
import { EditableGridCellEditor } from "../../EditableGrid2"

/**
 * 日付セルエディタを作成する。
 *
 * EditableGrid2 はセルエディタを標準搭載していないため、
 * html標準の <input type="date"> による日付編集の実装例としてここに置いている。
 * 利用側のプロジェクトにこのファイルをコピーして使うか、
 * これを参考に EditableGridCellEditor の契約を満たす自前のエディタを実装してください。
 *
 * セルの値は <input type="date"> の仕様に合わせて "yyyy-MM-dd" 形式の文字列とする。
 */
export function createDateCellEditor(): EditableGridCellEditor {

  return React.forwardRef(function DateCellEditor({ style, isEditing, requestCommit, requestCancel }, ref) {

    const [value, setValue] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement>(null)

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = e => {
      setValue(e.target.value)
    }

    // エディタ内部のキー操作
    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
      if (!isEditing) return
      // 編集を確定させる
      if (e.key === 'Enter' || e.key === 'Tab') {
        requestCommit(value)
        e.preventDefault()
      }
      // 編集をキャンセルする
      else if (e.key === 'Escape') {
        requestCancel()
        e.preventDefault()
      }
    }

    React.useImperativeHandle(ref, () => ({
      getCurrentValue: () => inputRef.current?.value ?? '',
      setValueAndSelectAll: (value, timing) => {
        setValue(value)
        setTimeout(() => {
          inputRef.current?.focus()
          if (timing === 'edit-start') inputRef.current?.showPicker?.()
        }, 0)
      },
      getDomElement: () => inputRef.current,
    }), [inputRef])

    const { height, ...restStyle } = style

    return (
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="px-1 py-px text-sm outline-none border border-black bg-white"
        style={restStyle}
      />
    )
  })
}
