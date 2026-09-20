import { Meta, StoryObj } from "@storybook/react-vite"
import { CellButtonExample } from "./CellButtonExample"
import { RenderingExample } from "./RenderingExample"

const storybookSetting: Meta = {
  title: "基本の使い方/セルの描画",
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const セルの描画: StoryObj = { render: () => <RenderingExample /> }
export const セル内のボタン: StoryObj = { render: () => <CellButtonExample /> }
