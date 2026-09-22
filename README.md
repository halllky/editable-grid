# @halllky/editable-grid

React + TanStack Table ベースの編集可能グリッドコンポーネント。

```
npm install @halllky/editable-grid
```

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
npm pack --dry-run      # 公開されるファイルの一覧を確認
```

破壊的変更がある場合は、`src/stories/**/index.mdx` のドキュメントと
`*.stories.tsx` のデモが新しい API に追従しているかを確認する。

### 2. バージョンを上げる

`package.json` の `version` を更新する（semver）。
npm に同じバージョンは二度と公開できないため、公開のたびに必ず上げること。

- パッチ: 後方互換のバグ修正
- マイナー: 後方互換の機能追加
- メジャー: 破壊的変更

### 3. main へマージ

作業ブランチを `main` にマージする。
`main` への push をトリガーに Storybook が GitHub Pages へ自動デプロイされる
(`.github/workflows/deploy-storybook.yml`)。

### 4. npm に公開

`main` の最新をチェックアウトした状態で実行する。
`prepublishOnly` で型チェックと `dist` のビルドが自動で走る。

```
npm login   # 初回のみ
npm publish
```

### 5. タグを打って push

```
git tag vX.Y.Z
git push && git push --tags
```

### 6. デプロイ結果の確認

- https://www.npmjs.com/package/@halllky/editable-grid に新しいバージョンが表示されていること
- GitHub の Actions タブで `Deploy Storybook to GitHub Pages` が成功していること
- https://halllky.github.io/editable-grid/ が更新されていること

### 7. 利用側の更新

```
npm install @halllky/editable-grid@X.Y.Z
```

## Storybook のデプロイ

上記ドキュメントは `main` ブランチへの push で GitHub Pages に自動デプロイされる。

- ワークフロー: `.github/workflows/deploy-storybook.yml`
- 手動実行したい場合は Actions タブから `Run workflow`

初回のみリポジトリ側の設定が必要:
Settings > Pages > Build and deployment > Source を **GitHub Actions** に変更する。

なお `src/stories_only-dev/` 配下（開発時だけの実験用ページ）は
`storybook build` の対象外のため、公開される Storybook には含まれない。
