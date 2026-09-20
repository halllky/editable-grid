import { Meta, StoryObj } from "@storybook/react-vite"
import { FixedColumnExample } from "./FixedColumnExample"

const storybookSetting: Meta = {
  title: "レイアウト/列固定",
  tags: ["!dev"], // サイドメニューに表示させない
}

export default storybookSetting

export const 列固定: StoryObj = { render: () => <FixedColumnExample /> }
