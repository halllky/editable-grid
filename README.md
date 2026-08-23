# @halllky/react-editable-grid

React + TanStack Table ベースの編集可能グリッドコンポーネント。

## Install

```
npm install "@halllky/react-editable-grid@git+ssh://git@github.com/halllky/react-editable-grid.git#v0.1.0"
```

peerDependencies として以下が必要です:

- react ^19
- @tanstack/react-table ^8.21
- @tanstack/react-virtual ^3.14

スタイルはパッケージに同梱されており、`import { EditableGrid2 } from '@halllky/react-editable-grid'`
するだけで自動的に適用されます。利用側で Tailwind CSS を設定する必要はありません。

CSS クラス名はすべて `halllky-eg2-` プレフィックスが付いているため、利用側の CSS と衝突しません。

配色は `.halllky-eg2-root` に定義された CSS 変数を上書きすることでカスタマイズできます。

```css
.halllky-eg2-root {
  --halllky-eg2-color-grid-bg: #e5e7eb;
  --halllky-eg2-color-cell-bg: #ffffff;
  --halllky-eg2-color-cell-bg-striped: #f9fafb;
  --halllky-eg2-color-header-bg: #f3f4f6;
  --halllky-eg2-color-readonly-bg: #e5e7eb;
  --halllky-eg2-color-border: #d1d5db;
  --halllky-eg2-color-resize-handle-hover: #9ca3af;
  --halllky-eg2-color-empty-text: #6b7280;
  --halllky-eg2-color-selection-border: #0ea5e9;
  --halllky-eg2-color-selection-fill: #bae6fd;
}
```

`EditableGrid2` の `className` / `getRowClassName` プロパティは従来どおり任意のクラス文字列を
受け付けます。利用側が Tailwind を使っている場合は、そのまま Tailwind クラスを渡せます。

## Develop

```
npm install
npm run storybook # デバッグ起動
npm run build     # dist を生成
npm run tsc       # 型チェックのみ
```

## Release

1. `src/` を修正
2. `package.json` の version を上げる
3. commit / tag (`git tag vX.Y.Z`) / push (`git push && git push --tags`)
4. 利用側の package.json の依存を `#vX.Y.Z` に更新して `npm install`
