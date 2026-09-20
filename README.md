# @halllky/react-editable-grid

React + TanStack Table ベースの編集可能グリッドコンポーネント。

## Install

```
npm install "@halllky/react-editable-grid@git+ssh://git@github.com/halllky/react-editable-grid.git#v0.1.0"
```

peerDependencies として以下が必要です:

- react ^19
- @tanstack/react-table ^9.2
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
  --halllky-eg2-color-border: #d1d5db;
  --halllky-eg2-color-resize-handle-hover: #9ca3af;
  --halllky-eg2-color-empty-text: #6b7280;
  --halllky-eg2-color-selection-border: #0ea5e9;
  --halllky-eg2-color-selection-fill: #bae6fd;
}
```

`EditableGrid2` の `className` / `getRowClassName` プロパティは従来どおり任意のクラス文字列を
受け付けます。利用側が Tailwind を使っている場合は、そのまま Tailwind クラスを渡せます。

## ドキュメント（AI 向け）

パッケージには Storybook のドキュメント一式（`.mdx`）とデモの実装（`.stories.tsx`）が同梱されています。

```
node_modules/@halllky/react-editable-grid/src/stories/**/index.mdx          … 解説
node_modules/@halllky/react-editable-grid/src/stories/**/*.stories.tsx      … 実装例
```

コーディングエージェントに使い方を調べさせる場合は上記を読ませてください。
なお同梱ファイルはビルド対象ではなく、閲覧用のソースです。TypeScript としてコンパイルされることは想定していません。
デモ内の `import { ... } from "../../EditableGrid2"` は、利用側では
`import { ... } from "@halllky/react-editable-grid"` に読み替えてください。

## Develop

```
npm install
npm run storybook # デバッグ起動
npm run build     # dist を生成
npm run tsc       # 型チェックのみ
```

## Release

リリースは人間が手作業で行う。以下の手順で実施すること。

### 1. リリース前の確認

作業ブランチで以下がすべて通ることを確認する。

```
npm run tsc             # 型チェック
npm run build           # dist が生成できること
npm run build-storybook # Storybook がビルドできること
```

破壊的変更がある場合は、`src/stories/**/index.mdx` のドキュメントと
`*.stories.tsx` のデモが新しい API に追従しているかを確認する。

### 2. バージョンを上げる

`package.json` の `version` を更新する（semver）。
[ドキュメントのインストール手順](./src/stories/introduction/index.mdx) の番号も更新する。

- パッチ: 後方互換のバグ修正
- マイナー: 後方互換の機能追加
- メジャー: 破壊的変更

### 3. main へマージ

作業ブランチを `main` にマージする。
`main` への push をトリガーに Storybook が GitHub Pages へ自動デプロイされる
(`.github/workflows/deploy-storybook.yml`)。

### 4. タグを打って push

```
git tag vX.Y.Z
git push && git push --tags
```

このリポジトリは npm レジストリに publish せず、Git のタグを参照して
インストールする運用のため、**タグが実質的なリリース成果物**となる。
タグを打ち忘れると利用側がそのバージョンを取得できない。

### 5. デプロイ結果の確認

- GitHub の Actions タブで `Deploy Storybook to GitHub Pages` が成功していること
- https://halllky.github.io/react-editable-grid/ が更新されていること

### 6. 利用側の更新

利用側の `package.json` の依存を `#vX.Y.Z` に更新して `npm install`。

## Storybook の公開

`main` ブランチへの push で Storybook が GitHub Pages に自動デプロイされる。

- 公開 URL: https://halllky.github.io/react-editable-grid/
- ワークフロー: `.github/workflows/deploy-storybook.yml`
- 手動実行したい場合は Actions タブから `Run workflow`

初回のみリポジトリ側の設定が必要:
Settings > Pages > Build and deployment > Source を **GitHub Actions** に変更する。

なお `src/stories_only-dev/` 配下（開発時だけの実験用ページ）は
`storybook build` の対象外のため、公開される Storybook には含まれない。
