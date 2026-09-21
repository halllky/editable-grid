# @halllky/editable-grid

React + TanStack Table ベースの編集可能グリッドコンポーネント。

## ドキュメント

インストール方法と使い方は Storybook のドキュメントを参照してください。

https://halllky.github.io/editable-grid/

## ドキュメント（AI 向け）

パッケージには Storybook のドキュメント一式（`.mdx`）とデモの実装（`.stories.tsx`）が同梱されています。

```
node_modules/@halllky/editable-grid/src/stories/**/index.mdx          … 解説
node_modules/@halllky/editable-grid/src/stories/**/*.stories.tsx      … 実装例
```

コーディングエージェントに使い方を調べさせる場合は上記を読ませてください。
なお同梱ファイルはビルド対象ではなく、閲覧用のソースです。TypeScript としてコンパイルされることは想定していません。
デモ内の `import { ... } from "../../EditableGrid"` は、利用側では
`import { ... } from "@halllky/editable-grid"` に読み替えてください。

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
- https://halllky.github.io/editable-grid/ が更新されていること

### 6. 利用側の更新

利用側の `package.json` の依存を `#vX.Y.Z` に更新して `npm install`。

## Storybook のデプロイ

上記ドキュメントは `main` ブランチへの push で GitHub Pages に自動デプロイされる。

- ワークフロー: `.github/workflows/deploy-storybook.yml`
- 手動実行したい場合は Actions タブから `Run workflow`

初回のみリポジトリ側の設定が必要:
Settings > Pages > Build and deployment > Source を **GitHub Actions** に変更する。

なお `src/stories_only-dev/` 配下（開発時だけの実験用ページ）は
`storybook build` の対象外のため、公開される Storybook には含まれない。
