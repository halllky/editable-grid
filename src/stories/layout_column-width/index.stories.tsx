import { Meta, StoryObj } from "@storybook/react-vite"
import { ColumnWidthExample } from "./ColumnWidthExample"

const storybookSetting: Meta = {
  title: "レイアウト/列幅",
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 列幅: StoryObj = { render: () => <ColumnWidthExample /> }
