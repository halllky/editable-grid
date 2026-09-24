import { EditableGridCellRange, EditableGridPastePlanner } from "../types-public"

/**
 * 既定のペースト処理
 *
 * - 1セルだけ選択している場合：貼り付ける内容のサイズに合わせて選択範囲を拡張し、
 *   拡張後の範囲を nextSelectedRange として返す。
 * - 複数セルの範囲を選択している場合：選択範囲は広げず、貼り付ける内容を範囲内に
 *   行・列とも剰余で折り返して敷き詰める。
 *
 * グリッドの大きさによる切り詰めはここでは行わない（グリッド側が実行時に吸収する）。
 */
export const defaultPastePlanner: EditableGridPastePlanner = ({ values, selectedRange }) => {
  // ペーストデータのうち長さ0の配列部分は長さ1の配列と読み替える
  const normalizedValues = values.length === 0
    ? [['']]
    : values.map(row => row.length === 0 ? [''] : row)

  const startRow = selectedRange.startRow
  const startCol = selectedRange.startCol

  let endRow: number
  let endCol: number
  let nextSelectedRange: EditableGridCellRange | undefined

  // 範囲選択していない場合、ペースト完了後の選択範囲は
  // クリップボードに入っていたテキストの範囲まで拡張する
  const isOneCellSelected = selectedRange.startRow === selectedRange.endRow
    && selectedRange.startCol === selectedRange.endCol

  if (isOneCellSelected) {
    endRow = startRow + normalizedValues.length - 1
    endCol = startCol + normalizedValues[0].length - 1
    nextSelectedRange = { startRow, startCol, endRow, endCol }
  } else {
    endRow = selectedRange.endRow
    endCol = selectedRange.endCol
    nextSelectedRange = undefined
  }

  const rowCount = endRow - startRow + 1
  const colCount = endCol - startCol + 1

  // どのセルをどの値で書き換えるかを決める
  const writes: { rowIndex: number; colIndex: number; value: string }[] = []
  for (let r = 0; r < rowCount; r++) {
    const pasteRowIdx = r % normalizedValues.length
    const rowInputData = normalizedValues[pasteRowIdx]
    if (!rowInputData.length) continue

    for (let c = 0; c < colCount; c++) {
      const pasteColIdx = c % rowInputData.length
      writes.push({
        rowIndex: startRow + r,
        colIndex: startCol + c,
        value: rowInputData[pasteColIdx],
      })
    }
  }

  return { writes, nextSelectedRange }
}
