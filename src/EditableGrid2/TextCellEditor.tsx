import React from "react"
import { EditableGridCellEditor } from "./types-public"

/**
 * テキストセルエディタ。
 * 
 * EditableGrid2 で特定のセル1個の値を
 * キーボード入力で編集するためのエディタの標準的実装。
 */
export const TextCellEditor: EditableGridCellEditor = React.forwardRef(function DefaultEditor({ style, isEditing, requestCommit, requestCancel }, ref) {

  const [value, setValue] = React.useState<string>('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = e => {
    setValue(e.target.value)
  }

  // エディタ内部のキー操作
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = e => {
    // 編集を確定させる
    if (isEditing) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (e.shiftKey) return; // セル内改行のため普通のEnterでは編集終了しないようにする

        requestCommit(value)
        e.preventDefault()
      }
      // 編集をキャンセルする
      else if (e.key === 'Escape') {
        requestCancel()
        e.preventDefault()
      }
    }
  }

  React.useImperativeHandle(ref, () => ({
    blur: () => textareaRef.current?.blur(),
    getCurrentValue: () => textareaRef.current?.value ?? '',
    setValueAndSelectAll: (value: string) => {
      setValue(value)
      textareaRef.current?.select()
    },
    getDomElement: () => textareaRef.current,
  }), [textareaRef])

  return (
    <textarea
      ref={textareaRef}
      value={value ?? ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="px-[3px] resize-none field-sizing-content outline-none border border-black bg-white"
      style={style}
    />
  )
})
