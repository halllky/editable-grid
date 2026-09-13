import React from "react"

//#region グリッド

/**
 * EditableGrid2 のプロパティ
 */
export type EditableGrid2Props<TRow> = {
  /**
   * 行を一意に識別する文字列の配列。
   *
   * - 配列の長さがそのままグリッドの行数になります。
   * - 各要素がその行のIDとして使われます。重複する値を含めてはいけません。
   * - この配列の内容（各要素の値と並び順）が変化すると、
   *   行の追加・削除・並び替えが発生したものとしてグリッドが再描画されます。
   *   逆に内容が同じであれば、毎回新しい配列インスタンスを渡しても再描画は発生しないため、
   *   呼び出し側で useMemo する必要はありません。
   * 行に表示される値そのものは、この配列ではなく getLatestRowObject から取得されます。
   *
   */
  rowKeys: string[]

  /**
   * 指定されたインデックスの行の最新の値を取得する関数。
   *
   * セルの描画・編集・コピー＆ペーストで使用される行の値は、すべてこの関数から取得されます。
   * そのため、React Hook Form と連携する場合は getValues を使って実装することで、
   * rowKeys を再生成することなく（グリッドの再レンダリングを発生させることなく）
   * セルの値を setValue 等で更新できます。
   */
  getLatestRowObject: (index: number) => TRow
  /**
   * 列定義。
   * この配列の参照が変わると、描画範囲内に存在するすべてのセルとヘッダが再レンダリングされる。
   * そのため基本的には `useMemo` を用いて参照を安定させることを推奨。
   * 
   * その場合、 useMemo の一般的なルール通り、列定義内の関数（renderBody 等）が参照する外側の値は依存配列に含めること。
   * 含めない場合、その値が変わっても列定義内の関数は古い値を参照したままになる。
   */
  columns: EditableGrid2Column<TRow>[]
  /** 行ヘッダのチェックボックスを表示するかどうか。 */
  showCheckBox?: boolean | ((row: TRow, rowIndex: number) => boolean)
  /** trueの場合はグリッド全体が読み取り専用。関数を設定した場合は行単位で判定される。 */
  isReadOnly?: boolean | ((row: TRow, rowIndex: number) => boolean)
  /** スタイル調整用 */
  className?: string
  /** 行のclassNameを取得する関数。基本的にその行のテキスト色を変更する程度の想定。 */
  getRowClassName?: (row: TRow) => string
  /** フォーカスが外れたときに選択をクリアするかどうか */
  clearSelectionOnBlur?: boolean
  /** 表示範囲外の行をどこまで予め読み込んでおくか。既定値は10 */
  rowOverscan?: number
  /** 
   * 表示範囲外の列をどこまで予め読み込んでおくか。
   * 固定列はこの値に関わらず常に描画される。既定値は3。
   * セル内に改行が含まれる場合など、行の高さが一定でない場合、描画範囲次第で行の高さが動的に変わる。
   * その挙動を嫌う場合はこの値をとても大きくすることで回避できる。
   */
  columnOverscan?: number
  /** 偶数の行と奇数の行で背景色を交互に変更するかどうか */
  striped?: boolean
  /** セルエディタ。列定義で指定がある場合はそちらが優先される。 */
  editor?: EditableGridCellEditor
  /** データが無い時に表示される。既定では「データがありません。」と表示される。 */
  whenNoData?: React.ReactNode
  /**
   * クリップボードとの文字列変換方法。
   * 未指定の場合は defaultCopyPasteFormat（TSV。Excel等との相互コピペを想定した仕様）が使われる。
   */
  clipboardFormat?: EditableGrid2ClipboardFormat
  /**
   * 貼り付け（Ctrl+V）・クリア（Delete）で「どのセルに何を書き込むか」を決める関数。
   * 未指定の場合は defaultPastePlanner が使われる
   * （1セル選択時は選択範囲を拡張、複数セル選択時は剰余で敷き詰める）。
   */
  planPaste?: EditableGrid2PastePlanner
}

/**
 * EditableGrid2 の参照オブジェクト
 */
export type EditableGrid2Ref<TRow> = {
  /** セルエディタによる編集が行われているかどうか */
  isEditing: boolean
  /** 選択されている行の取得 */
  getSelectedRows: () => { row: TRow, rowIndex: number }[]
  /** 行頭のチェックボックスで選択されている行を取得する。チェックボックスが表示されていない行は含まれない。 */
  getCheckedRows: () => { row: TRow, rowIndex: number }[]
  /** 指定した範囲の行を選択する */
  selectRow: (startRowIndex: number, endRowIndex: number) => void
  /** 強制的にテーブルを再描画する */
  forceUpdate: () => void
}

//#endregion グリッド

//#region 列

/**
 * EditableGrid2 の列定義
 */
export type EditableGrid2Column<TRow> =
  | EditableGrid2GroupColumn<TRow>
  | EditableGrid2LeafColumn<TRow>

/**
 * EditableGrid2 の列定義（グループ化された列）
 */
export type EditableGrid2GroupColumn<TRow> = {
  /** グループヘッダ列のレンダリング */
  renderHeader: EditableGrid2HeaderRenderer
  /** グループ化する子列の定義 */
  columns: EditableGrid2LeafColumn<TRow>[]
  /**
   * グループ列のID。グリッド内で（他のグループ・リーフ列を含めて）重複してはいけない。
   * 列の増減・並べ替えの検知に使われるため必須。
   */
  columnId: string
}

/**
 * EditableGrid2 の列定義（グループ化されていない列）
 */
export type EditableGrid2LeafColumn<TRow> = {
  /** 列のヘッダーのレンダリング処理をカスタマイズする関数。 */
  renderHeader: EditableGrid2HeaderRenderer
  /** 列のヘッダーのうち、グルーピングが発生している場合のグループ化されない列の下段のレンダリング処理をカスタマイズする関数。 */
  renderHeaderPlaceholder?: EditableGrid2HeaderRenderer
  /**
   * 列のフッターのレンダリング処理。配列を指定した場合は上から順に1段ずつ描画される。
   *
   * - 行の値は引数として渡されない。パフォーマンスのためボディ行の変化による自動再レンダリングは発生しない。
   *   合計値などの表示に必要な値はレンダリング処理内部でウォッチやサブスクライブして直接取得すること。
   * - 各レンダリング関数はコンポーネントとして描画されるため、内部でフックを呼び出せる。
   * - 段数は列ごとに揃っていなくてよい。段が足りない列のフッターセルは空で表示される。
   * - 表示専用を想定している。グリッドがアクティブな間はセルエディタが常にフォーカスを保持するため、
   *   入力要素を配置することは想定していない。
   */
  renderFooter?: EditableGrid2FooterRenderer
  /**
   * セルのボディのレンダリング処理をカスタマイズする関数。
   * セルの中にボタンを配置するなど、セル選択を防ぎたい要素がある場合、
   * mouseDown イベントの stopPropagation を呼び出し、イベントの伝播を防ぐこと。
   */
  renderBody: EditableGrid2BodyRenderer<TRow>
  /**
   * 列のID。グリッド内で（他のリーフ・グループ列を含めて）重複してはいけない。
   * 列幅の保持・復元や、列の増減・並べ替えの検知に使われるため必須。
   */
  columnId: string
  /** 画面初期表示時の列の幅（pxで指定） */
  defaultWidth?: number
  /** 
   * セルエディタ。未指定の場合はグリッドのプロパティで指定されたものが使われる。
   * 
   * エディタコンポーネントの参照は安定させること。
   * 列定義の中でその場でコンポーネントを生成する（例: `editor: createTextCellEditor()`）と、
   * 列定義が再評価されるたびに別のコンポーネント型になり、
   * セルエディタが不必要に unmount / mount を繰り返す。
   * モジュールスコープの定数にするか、エディタ単体で useMemo すること。
   */
  editor?: EditableGridCellEditor
  /** セルエディタに表示する値を取得する関数。指定しない場合、この列は編集不可。 */
  getValueForEditor?: (args: { row: TRow, rowIndex: number }) => string
  /** セルエディタの値を設定する関数。指定しない場合、値が編集されても反映されない。 */
  setValueFromEditor?: (args: { row: TRow, rowIndex: number, value: string }) => void
  /**
   * 列が読み取り専用かどうか。
   * trueの場合はセルの背景色が変わるのと、
   * 編集開始系のイベントが発生しなくなる。
   */
  isReadOnly?: boolean | ((row: TRow, rowIndex: number) => boolean)
  /** 列の幅を変更できなくする場合はtrue */
  disableResizing?: boolean
  /** 列が非表示になるかどうか */
  invisible?: boolean
  /** 列が固定されるかどうか */
  isFixed?: boolean
  /**
   * @deprecated 折り返し表示はセルのレンダリング（renderBody）とセルエディタ（editor）側の責務とする。
   * グリッド側では折り返しの有無によってスタイルを切り替えないため、この属性は使用しない。
   */
  wrap?: never
  /**
   * セル上でキーが押されたときのイベントハンドラ。
   * preventDefault が呼ばれた場合、キーによるセル移動やセル編集開始といった
   * EditableGrid2 の既定の動作がキャンセルされます。
   */
  onCellKeyDown?: (args: {
    row: TRow
    rowIndex: number
    event: React.KeyboardEvent
    /** 編集開始を要求する関数。呼び出すとセル編集が開始される。 */
    requestEditStart: () => void
  }) => void
}

/** 列ヘッダセルのレンダリング処理 */
export type EditableGrid2HeaderRenderer = (args: {
  /** この列の現在の幅（px） */
  columnWidth: number
}) => React.ReactNode

/** フッターセル1段分のレンダリング処理 */
export type EditableGrid2FooterCellRenderer = (args: {
  /** この列の現在の幅（px） */
  columnWidth: number
}) => React.ReactNode

/** 列フッターのレンダリング処理。配列の場合は上から順に1段ずつ描画される */
export type EditableGrid2FooterRenderer =
  | EditableGrid2FooterCellRenderer
  | EditableGrid2FooterCellRenderer[]

/** ボディセルのレンダリング処理 */
export type EditableGrid2BodyRenderer<TRow> = (args: {
  /** この行の最新の値。getLatestRowObject の戻り値。 */
  row: TRow
  /** 行インデックス。画面表示範囲外も含めたデータ全体内での配列内の位置。 */
  rowIndex: number
  /** この列の現在の幅（px） */
  columnWidth: number
  /** グリッド全体の読み取り専用、行単位の読み取り専用、セル単位の読み取り専用を判定した結果 */
  isReadOnly: boolean
}) => React.ReactNode

//#endregion 列

//#region コピー＆ペースト

/**
 * セル範囲。両端を含む。
 * 列インデックスは可視データ列を左から0始まりで数えたもの（行チェックボックス列は含まない）。
 */
export type EditableGrid2CellRange = {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

/**
 * クリップボードとの文字列変換。
 * 往復（コピーしてペースト）した際に内容が保たれるよう、stringify と parse は対で指定すること。
 */
export type EditableGrid2ClipboardFormat = {
  /** コピー時、選択範囲のセルの値（2次元配列）をクリップボードへ書き込む文字列に変換する。 */
  stringify: (values: string[][]) => string
  /** ペースト時、クリップボードから読み取った文字列をセルの値の2次元配列に変換する。 */
  parse: (text: string) => string[][]
}

/** 貼り付け先のセルと値の組。 */
export type EditableGrid2CellWrite = {
  rowIndex: number
  colIndex: number
  value: string
}

/** 貼り付け計画。EditableGrid2PastePlanner の戻り値。 */
export type EditableGrid2PastePlan = {
  /** 書き込むセルと値。同じセルが複数回現れた場合は後に指定した方が採用される。 */
  writes: EditableGrid2CellWrite[]
  /** 貼り付け後の選択範囲。undefined の場合は選択範囲を変更しない。 */
  nextSelectedRange?: EditableGrid2CellRange
}

/**
 * 貼り付け内容と選択状態から、どのセルに何を書き込むかを決める関数。
 * `EditableGrid2Props.planPaste` として渡す。
 *
 * グリッドの状態を直接変更しない純粋関数として実装すること
 * （実際の書き込み・選択範囲の更新はグリッド側が行う）。
 * グリッドの状態を参照しないため、レンダリングのたびに新しい関数を渡してよい。
 *
 * グリッドは戻り値の writes のうち、グリッド外のセルや isCellWritable が false のセルへの
 * 書き込みを無視する。そのため、読み取り専用セルへ書き込むかどうかをこの関数の中で
 * 制御する必要はない（スキップ以外の挙動、例えば「1つでも含まれていたら全体を中止する」
 * といった方針を取りたい場合にのみ isCellWritable を参照すればよい）。
 */
export type EditableGrid2PastePlanner = (args: {
  /** クリップボードの内容（EditableGrid2ClipboardFormat.parse 済み）。Delete キーによる場合は [['']]。 */
  values: string[][]
  /** この計画が貼り付け（Ctrl+V）とクリア（Delete）のどちらによるものか。 */
  trigger: 'paste' | 'delete'
  /** 現在の選択範囲。1セルだけ選択している場合は start と end が同じ値になる。 */
  selectedRange: EditableGrid2CellRange
  /** 可視データ列の columnId。colIndex の並び順と一致する。 */
  columnIds: string[]
  /**
   * そのセルに書き込めるかどうか。
   * グリッド全体・行単位・列単位の読み取り専用設定と、列定義の setValueFromEditor の有無を
   * 考慮した結果が返る。範囲外の rowIndex / colIndex に対しては false を返す。
   */
  isCellWritable: (rowIndex: number, colIndex: number) => boolean
}) => EditableGrid2PastePlan

//#endregion コピー＆ペースト

//#region セルエディタ

/**
 * セル編集エディタのコンポーネント。
 * EditableGrid2Props.editor または列定義の editor として渡す。
 *
 * このコンポーネントは編集対象セルが存在する限り、編集中かどうかに関わらず常にDOM上にマウントされ続け、
 * かつグリッドがアクティブな間は常にフォーカスを保持する（キーボード入力・IME変換を横取りするため）。
 * 非編集時は props.style によって不可視状態（opacity: 0 等）に制御される。
 * 列によって異なるエディタコンポーネントが指定されている場合、フォーカス移動時にコンポーネント自体が
 * 差し替わる（アンマウント→マウント）ため、コンポーネント内部のstateは編集対象セルが変わるたびにリセットされる
 * 前提で実装すること（値の復元は props.style 適用後に ref.setValueAndSelectAll 経由で行われる）。
 */
export type EditableGridCellEditor = React.ForwardRefExoticComponent<
  EditableGridCellEditorProps &
  React.RefAttributes<EditableGridCellEditorRef>
>

/** セル編集エディタのプロパティ */
export type EditableGridCellEditorProps = {
  /**
   * スタイル。エディタの位置・サイズ・可視状態
   * （非編集時は opacity: 0, pointer-events: none 等）が渡される。
   * ルート要素（ref.getDomElement が返す要素と同一の要素、もしくはその祖先）にそのまま適用すること。
   * 適用しない場合、エディタの表示位置がずれたり、非編集時にも操作可能な状態で表示されてしまう。
   *
   * width, height は常にセルそのものの大きさが渡される。
   * 折り返し表示等でエディタをセルより大きく伸縮させたい場合は、
   * エディタ側でこれらの値を minWidth, minHeight に読み替えて使用すること。
   */
  style: Pick<React.CSSProperties,
    | "position"
    | "zIndex"
    | "opacity"
    | "pointerEvents"
    | "left"
    | "top"
    | "height"
    | "width"
  >
  /**
   * セルが実際に編集中かどうか。
   * フォーカスは編集中でなくても常に当たっているため、この値で「今キー入力を編集操作として扱ってよいか」を
   * 判定すること（例: Enter/Escape で確定・キャンセルする処理は isEditing === true の間だけ行う）。
   */
  isEditing: boolean
  /**
   * 編集内容を確定してほしいときにエディタ側から呼び出す（例: Enter/Tabキー押下時）。
   * 呼び出すと isEditing が false になり、渡した value が列定義の setValueFromEditor に渡される。
   * なお、グリッド外クリックなど、エディタが自ら呼び出さずに編集が確定するケースもあり、
   * その場合はグリッド側が ref.getCurrentValue() を呼んで値を取得するため、
   * getCurrentValue が返す値は常にこの value と一致する（=最新の入力内容を保持する）ようにすること。
   */
  requestCommit: (value: string) => void
  /**
   * 編集を破棄してキャンセルしてほしいときにエディタ側から呼び出す（例: Escapeキー押下時）。
   * 呼び出すと isEditing が false になり、直後に ref.setValueAndSelectAll が
   * timing: 'edit-end' で呼ばれ、編集前の値に戻される。
   */
  requestCancel: () => void
}

/**
 * セル編集エディタのref。
 * EditableGridCellEditor は forwardRef でこれらのメソッドを exposeする必要がある。
 * いずれのメソッドも、グリッド側から任意のタイミング（フォーカス移動時・編集開始時・編集終了時）で
 * 呼び出されることを前提に、常に呼び出し可能な状態を維持すること。
 */
export type EditableGridCellEditorRef = {
  /**
   * エディタが現在保持している値を返す。
   * requestCommit を経由せずに編集が確定される場合（グリッド外クリックによる自動確定など）に
   * グリッド側から呼び出され、この戻り値がそのままセルの値として採用される。
   * そのため、ユーザーの入力に追従して常に最新の値を返す実装にすること。
   */
  getCurrentValue: () => string
  /**
   * グリッド側からエディタの表示値を強制的に書き換え、かつ内容を全選択状態にする。
   * 呼び出されるタイミングは timing 引数で区別される。
   * - `move-focus`: 編集を伴わないフォーカスセルの移動直後。エディタは不可視のままだが、
   *   次にクイック入力（セル選択中にキーを打鍵してそのまま編集開始する操作）が起きた際に
   *   正しい初期値・IME状態から編集を始められるよう、フォーカス移動先セルの値を先読みしてセットする。
   * - `edit-start`: 編集開始直後。ダブルクリック/Enterキー等での通常の編集開始時はセルの現在値が、
   *   キー入力によるクイック編集開始時は最初に入力された1文字が value として渡される。
   * - `edit-end`: requestCommit / requestCancel による編集終了直後。
   *   キャンセル時は編集前の値、確定時は確定後の値が渡される。
   * 多くの実装では timing によらず value をそのままセットして全選択すればよいが、
   * タイミングに応じて挙動を変えたい場合（例: 'edit-start' のときだけ全選択する等）に利用できる。
   */
  setValueAndSelectAll: (value: string, timing: 'move-focus' | 'edit-start' | 'edit-end') => void
  /**
   * エディタのルート要素を取得する。
   * グリッド側が「画面外クリックによる編集確定」を行うかどうかを、
   * クリックされた要素がこの要素の子孫であるかどうかで判定するために使用する。
   * null を返すと、あらゆる外部クリックがエディタ外へのクリックとして扱われ、即座に確定処理が走る。
   */
  getDomElement: () => HTMLElement | null
}

//#endregion セルエディタ
