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
- react-hook-form ^7.79

スタイルは素の Tailwind CSS ユーティリティクラスを使用しています。CSS は同梱していないため、
利用側の Tailwind `content` 設定に `node_modules/@halllky/react-editable-grid/dist/**/*.js` を
追加してください。

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
