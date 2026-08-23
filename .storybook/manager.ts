import { addons } from "storybook/manager-api"

addons.setConfig({
  // Storybook 標準の Alt + ↑↓ によるページ移動の操作が
  // グリッドの編集操作と競合してしまわないようにするため禁止する
  enableShortcuts: false,
})
