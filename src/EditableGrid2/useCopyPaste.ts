import React from "react";
import * as TanStack from "@tanstack/react-table";
import { EditableGrid2CellRange, EditableGrid2Props } from "./types-public";
import { CellSelectionRange } from "./useSelection";
import { ColumnMetadataInternal } from "./types-internal";
import { RowAccessor } from "./useRowAccessor";
import { BatchDispatcher } from "./useBatchDispatcher";
import { defaultCopyPasteFormat } from "./default-copy-paste-format";
import { defaultPastePlanner } from "./default-paste-planner";

interface UseCopyPasteParams<TRow> {
  table: TanStack.Table<string>;
  selectedRange: CellSelectionRange | null;
  /**
   * ペースト時に選択範囲を拡張したらここに新しい選択範囲が渡される
   */
  onRangeUpdated?: (range: CellSelectionRange) => void;
  isEditing: boolean;
  getRowObject: RowAccessor<TRow>;
  batchDispatcher: BatchDispatcher;
  props: EditableGrid2Props<TRow>;
}

export const useCopyPaste = <TRow,>({
  table,
  selectedRange,
  onRangeUpdated,
  isEditing,
  getRowObject,
  batchDispatcher,
  props,
}: UseCopyPasteParams<TRow>) => {

  // 可視データ列（チェックボックス列を除いた、行チェックボックス列との colIndex オフセット調整用）を取得する
  const getDataColumns = () => {
    const columns = table.getVisibleLeafColumns();
    const offset = columns.length > 0 && (columns[0].columnDef.meta as ColumnMetadataInternal<TRow> | undefined)?.isRowCheckBox
      ? 1
      : 0;
    return { dataColumns: columns.slice(offset), offset };
  }

  const handleCopy: React.ClipboardEventHandler = e => {
    if (isEditing || !selectedRange) return;

    if (props.rowKeys.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const { dataColumns, offset } = getDataColumns();

    // 選択範囲内のセルの値を取得（列インデックスはデータ列基準に変換）
    const dataArray: string[][] = [];
    for (let r = selectedRange.startRow; r <= selectedRange.endRow; r++) {
      const rowData: string[] = [];
      // 行データの存在チェック
      if (r >= props.rowKeys.length) break;

      for (let c = selectedRange.startCol - offset; c <= selectedRange.endCol - offset; c++) {
        // 列定義の存在チェック
        if (c < 0 || c >= dataColumns.length) break;

        const col = dataColumns[c];
        const meta = col.columnDef.meta as ColumnMetadataInternal<TRow> | undefined;
        const colDef = meta?.original;

        let cellValue = '';
        if (colDef && colDef.getText) {
          const row = getRowObject(r);
          if (row) {
            cellValue = colDef.getText(row, r);
          }
        }
        rowData.push(cellValue);
      }
      dataArray.push(rowData);
    }

    const clipboardText = (props.clipboardFormat ?? defaultCopyPasteFormat).stringify(dataArray);
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', clipboardText);
    }
  }

  const handlePaste: React.ClipboardEventHandler = e => {
    if (isEditing || !selectedRange) return;

    // ペースト開始セルの読み取り専用チェック
    // （ループ内でもチェックするが、開始地点がダメなら全体をキャンセルするかどうか。
    //   EditableGrid (v1) の挙動に合わせて、ここでは開始セルのチェックは行わない。
    //   各セルごとにチェックして、書き込み可能な場所だけ書き込む。）

    e.preventDefault();
    e.stopPropagation();

    try {
      const clipboardText = e.clipboardData?.getData('text/plain') || '';
      const values = (props.clipboardFormat ?? defaultCopyPasteFormat).parse(clipboardText);

      runPastePlan(values, 'paste');
    } catch (err) {
      console.error('クリップボードからのペーストに失敗しました:', err);
    }
  }

  const handleDelete = () => {
    if (isEditing || !selectedRange) return;
    runPastePlan([['']], 'delete');
  }

  /**
   * planPaste（未指定時は defaultPastePlanner）を呼び出して貼り付け計画を立て、
   * その結果を実行する。
   * 列インデックスの基準の変換（内部座標 ⇔ データ列基準）はここで行う。
   * グリッド外・書き込み不可セルの除外と実際の書き込みは BatchDispatcher が行う。
   */
  const runPastePlan = (values: string[][], trigger: 'paste' | 'delete') => {
    if (!selectedRange) return;

    const { dataColumns, offset } = getDataColumns();

    const planSelectedRange: EditableGrid2CellRange = {
      startRow: selectedRange.startRow,
      startCol: selectedRange.startCol - offset,
      endRow: selectedRange.endRow,
      endCol: selectedRange.endCol - offset,
    };

    const columnIds = dataColumns.map(col => (col.columnDef.meta as ColumnMetadataInternal<TRow>).columnId);

    // データ列基準の列インデックスで判定する（行チェックボックス列を指さないよう範囲を限定する）
    const isCellWritable = (rowIndex: number, colIndex: number): boolean => {
      if (colIndex < 0 || colIndex >= dataColumns.length) return false;
      return batchDispatcher.isCellWritable(rowIndex, colIndex + offset);
    }

    const plan = (props.planPaste ?? defaultPastePlanner)({
      values,
      trigger,
      selectedRange: planSelectedRange,
      columnIds,
      isCellWritable,
    });

    // 1回の貼り付けにつき1回だけ onRowsChange が呼ばれるよう、まとめて書き込む
    batchDispatcher.dispatch(plan.writes
      .filter(write => write.colIndex >= 0 && write.colIndex < dataColumns.length)
      .map(write => ({
        rowIndex: write.rowIndex,
        colIndex: write.colIndex + offset,
        text: write.value,
      })));

    if (plan.nextSelectedRange && onRangeUpdated) {
      onRangeUpdated({
        startRow: plan.nextSelectedRange.startRow,
        startCol: plan.nextSelectedRange.startCol + offset,
        endRow: plan.nextSelectedRange.endRow,
        endCol: plan.nextSelectedRange.endCol + offset,
      });
    }
  }

  return { handleCopy, handlePaste, handleDelete };
};
