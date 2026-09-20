import { Meta, StoryObj } from "@storybook/react-vite"
import { ColumnGroupExample } from "./ColumnGroupExample"

const storybookSetting: Meta = {
  title: "レイアウト/多段列ヘッダ",
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 多段列ヘッダ: StoryObj = { render: () => <ColumnGroupExample /> }
