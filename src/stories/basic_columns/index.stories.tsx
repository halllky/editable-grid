import { Meta, StoryObj } from "@storybook/react-vite"
import { CellRenderingExample } from "./CellRenderingExample"
import { CellButtonExample } from "./CellButtonExample"
import { OuterValueExample } from "./OuterValueExample"

const storybookSetting: Meta = {
  title: "基本の使い方/列定義",
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const ヘッダとセルの描画: StoryObj = { render: () => <CellRenderingExample /> }
export const セル内のボタン: StoryObj = { render: () => <CellButtonExample /> }
export const 外側の値への依存: StoryObj = { render: () => <OuterValueExample /> }
