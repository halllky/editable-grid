import React from "react"
import { EditableGridCellEditor } from "../../EditableGrid2"

/**
 * テキストセルエディタ。
 *
 * EditableGrid2 はセルエディタを標準搭載していないため、
 * 文字列を編集するだけの最も単純なセルエディタの実装例としてここに置いている。
 * 利用側のプロジェクトにこのファイルをコピーして使うか、
 * これを参考に EditableGridCellEditor の契約を満たす自前のエディタを実装してください。
 *
 * @param wrap 折り返し表示をするかどうか。
 * props.style で渡される width, height はセルそのものの大きさだが、
 * 折り返し表示をする列ではテキストボックスを内容に応じて縦方向に伸縮させたいため、
 * ここで minWidth, minHeight に読み替える。
 */
export function createTextCellEditor(wrap: boolean): EditableGridCellEditor {

  return React.forwardRef(function EditableGridCellEditor({ style, isEditing, requestCommit, requestCancel }, ref) {

    const [value, setValue] = React.useState<string>('')
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)

    const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = e => {
      setValue(e.target.value)
    }

    // エディタ内部のキー操作
    const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = e => {
      // 編集を確定させる。
      // IME変換確定のEnterで編集が確定してしまわないよう、isComposintも考慮する
      if (isEditing && !e.nativeEvent.isComposing) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          // セル内改行のため普通のEnterでは編集終了しないようにする
          if (wrap && e.shiftKey) return;

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

    const { width, height, ...restStyle } = style

    return (
      <textarea
        ref={textareaRef}
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="px-1 py-px text-sm resize-none field-sizing-content outline-none border border-black bg-white"
        style={{
          ...restStyle,

          // wrapの指定によってwidth方向とheight方向のどちらに伸縮させるかを分ける。
          width: wrap ? width : undefined,
          minWidth: wrap ? undefined : width,
          minHeight: wrap ? height : undefined,

          // 編集中でないときはグリッドの下限を超えて余計なスクロールが出るのを防ぐため height を固定する
          height: isEditing ? undefined : height,
        }}
      />
    )
  })
}
