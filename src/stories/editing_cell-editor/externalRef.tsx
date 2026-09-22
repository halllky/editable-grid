import React from "react"

/**
 * 外部参照（コードと名称の組）の実装例一式。
 *
 * セルエディタの実演画面の本筋から外れる部分（擬似的なサーバー、検索ダイアログ、
 * コード照合の状態管理、コードセルの外観）をまとめて置いている。
 * 利用側のプロジェクトでは、この中身はアプリケーションごとに作り込むことになる。
 */

/** 外部参照先のマスタのデータ1件。 */
export type Product = {
  code: string
  name: string
}

/**
 * コード照合の状態。
 * 画面に表示するがサーバーに送るデータではないので、行オブジェクトの中には持たせない。
 */
export type ProductLookup = {
  /** 照合中かどうか */
  searching?: boolean
  /** コードがマスタに無かった場合のメッセージ */
  error?: string
}

// ------------------------------------
// 擬似的なサーバー

/** サーバーだけが持っているつもりのマスタ */
const PRODUCTS: Product[] = [
  { code: "P001", name: "りんご" },
  { code: "P002", name: "みかん" },
  { code: "P003", name: "ぶどう" },
  { code: "P004", name: "バナナ" },
  { code: "P101", name: "洗剤" },
  { code: "P102", name: "ティッシュ" },
  { code: "P103", name: "歯ブラシ" },
]

/** 通信待ちのつもり */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** コードに一致する1件を返す。見つからない場合は undefined。 */
async function findProductByCode(code: string): Promise<Product | undefined> {
  await delay(500)

  const normalized = code.trim().toLowerCase()
  return PRODUCTS.find(product => product.code.toLowerCase() === normalized)
}

/** コードまたは名称にキーワードを含むものを返す。 */
async function searchProducts(keyword: string): Promise<Product[]> {
  await delay(300)

  const normalized = keyword.trim().toLowerCase()
  if (normalized === "") return PRODUCTS
  return PRODUCTS.filter(product => (
    product.code.toLowerCase().includes(normalized)
    || product.name.toLowerCase().includes(normalized)
  ))
}

// ------------------------------------
// 画面側の処理

/**
 * 商品コードの照合と検索ダイアログを画面に組み込む。
 *
 * どちらの経路で商品が決まっても、行への反映はグリッドではなく画面側が行うため、
 * 反映処理は引数で受け取る。
 *
 * @param onProductDecided 商品が決まったときに呼ばれる。その行に反映すること。
 */
export function useProductSearch(onProductDecided: (rowKey: string, product: Product) => void) {

  const dialogRef = React.useRef<ProductSearchDialogRef>(null)
  const [lookups, setLookups] = React.useState<ReadonlyMap<string, ProductLookup>>(() => new Map())

  // 行ごとの最新の問い合わせ番号。古い問い合わせの結果を捨てるために使う。
  const requestSeq = React.useRef(new Map<string, number>())

  // 画面の再描画のたびに変わる関数をフックの外から受け取るため、ref 経由で最新のものを参照する
  const onProductDecidedRef = React.useRef(onProductDecided)
  onProductDecidedRef.current = onProductDecided

  const setLookup = React.useCallback((rowKey: string, lookup: ProductLookup | undefined) => {
    setLookups(prev => {
      const next = new Map(prev)
      if (lookup) next.set(rowKey, lookup); else next.delete(rowKey)
      return next
    })
  }, [])

  /** その行の照合状態を返す。名称セルの描画に使う。 */
  const getLookup = React.useCallback((rowKey: string) => lookups.get(rowKey), [lookups])

  /** 入力されたコードをサーバーに照合する。 */
  const lookup = React.useCallback(async (rowKey: string, code: string | undefined) => {
    const seq = (requestSeq.current.get(rowKey) ?? 0) + 1
    requestSeq.current.set(rowKey, seq)

    if (!code) {
      setLookup(rowKey, undefined)
      return
    }
    setLookup(rowKey, { searching: true })

    const product = await findProductByCode(code)

    // 問い合わせている間にその行の商品が決まり直していた場合、この結果は古いので捨てる
    if (requestSeq.current.get(rowKey) !== seq) return

    if (product) {
      onProductDecidedRef.current(rowKey, product)
      setLookup(rowKey, undefined)
    } else {
      setLookup(rowKey, { error: "コードが見つかりません。" })
    }
  }, [setLookup])

  /** 虫眼鏡ボタンから呼ばれる。検索ダイアログを開き、選ばれた商品を行に反映する。 */
  const openSearchDialog = React.useCallback(async (rowKey: string) => {
    const product = await dialogRef.current?.open()
    if (!product) return

    // 照合中だった場合、後から返ってくるその結果で上書きされないようにする
    requestSeq.current.set(rowKey, (requestSeq.current.get(rowKey) ?? 0) + 1)

    onProductDecidedRef.current(rowKey, product)
    setLookup(rowKey, undefined)
  }, [setLookup])

  return {
    getLookup,
    lookup,
    openSearchDialog,
    /** 画面のどこかに配置する検索ダイアログ */
    searchDialog: <ProductSearchDialog ref={dialogRef} />,
  }
}

/**
 * 外部参照のコードセルの外観。
 *
 * 虫眼鏡ボタンはセルエディタではなくこちら側に置く。
 * セルエディタは編集中しか見えないため、編集していないセルにボタンを出せないため。
 */
export function ProductCodeCell({ code, onSearchButtonClick }: {
  code: string | undefined
  onSearchButtonClick: () => void
}) {
  return (
    // 編集中はセルエディタがセルの上端を覆うため、ボタンも上端に置く
    <div className="flex items-start w-full">
      <span className="flex-1 min-w-0 px-1 py-px border border-transparent text-sm truncate">{code}</span>
      <button
        type="button"
        onClick={onSearchButtonClick}
        title="検索"
        className="px-1 py-px text-sm cursor-pointer"
      >
        🔍
      </button>
    </div>
  )
}

// ------------------------------------
// 検索ダイアログ

type ProductSearchDialogRef = {
  /**
   * ダイアログを開き、商品が選ばれるまで待つ。
   * 選ばれた商品を返す。選ばずに閉じられた場合は undefined を返す。
   */
  open: () => Promise<Product | undefined>
}

/**
 * 商品の検索ダイアログ。グリッドとは無関係な、ごく普通のダイアログ。
 * 選ばれた商品をオブジェクトのまま呼び出し元に返す。
 */
const ProductSearchDialog = React.forwardRef<ProductSearchDialogRef>(function ProductSearchDialog(_props, ref) {

  const dialogRef = React.useRef<HTMLDialogElement>(null)
  const resolveRef = React.useRef<((product: Product | undefined) => void) | undefined>(undefined)

  const [keyword, setKeyword] = React.useState('')
  const [products, setProducts] = React.useState<Product[]>([])
  const [isSearching, setIsSearching] = React.useState(false)

  const search = async (keyword: string) => {
    setIsSearching(true)
    try {
      setProducts(await searchProducts(keyword))
    } finally {
      setIsSearching(false)
    }
  }

  React.useImperativeHandle(ref, () => ({
    open: () => new Promise<Product | undefined>(resolve => {
      resolveRef.current = resolve
      setKeyword('')
      search('')
      dialogRef.current?.showModal()
    }),
  }), [])

  // 閉じる（商品が選ばれなかった場合は undefined）
  const close = (product?: Product) => {
    resolveRef.current?.(product)
    resolveRef.current = undefined
    dialogRef.current?.close()
  }

  const handleKeywordKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      search(keyword)
      e.preventDefault()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      // Escapeキーやブラウザの操作で閉じられた場合も待っている側に結果を返す
      onClose={() => close(undefined)}
      className="m-auto w-80 border border-gray-500 backdrop:bg-black/30"
    >
      <div className="flex flex-col gap-2 p-2 text-sm">
        <span className="font-bold">商品の検索</span>

        <div className="flex gap-1">
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder="コードまたは名称"
            className="flex-1 min-w-0 px-1 border border-gray-500 outline-none"
          />
          <button
            type="button"
            onClick={() => search(keyword)}
            className="px-2 border border-gray-500 bg-white cursor-pointer"
          >
            検索
          </button>
        </div>

        <ul className="flex flex-col h-48 overflow-y-auto border border-gray-300">
          {isSearching ? (
            <li className="px-1 text-gray-500">検索中...</li>
          ) : products.length === 0 ? (
            <li className="px-1 text-gray-500">該当する商品がありません。</li>
          ) : products.map(product => (
            <li key={product.code}>
              <button
                type="button"
                onClick={() => close(product)}
                className="flex gap-2 w-full px-1 text-left hover:bg-sky-100 cursor-pointer"
              >
                <span className="w-12">{product.code}</span>
                <span>{product.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => close(undefined)}
          className="self-end px-2 border border-gray-500 bg-white cursor-pointer"
        >
          キャンセル
        </button>
      </div>
    </dialog>
  )
})
