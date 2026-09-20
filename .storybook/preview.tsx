import type { Preview } from '@storybook/react-vite'
import './preview.css'
import * as theming from 'storybook/theming';

const preview: Preview = {
  parameters: {
    // サイドメニューの並び順。ここに無いページは末尾に並ぶ
    options: {
      storySort: {
        order: [
          "はじめに",
          "基本の使い方", ["最小限の実装", "セルの描画", "react-hook-form との統合"],
          "レイアウト", ["列固定", "多段列ヘッダ", "列幅"],
          "選択",
          "編集", ["セルエディタ", "コピー＆ペースト", "読み取り専用", "セル単位のエラー表示"],
          "その他", ["パフォーマンス"],
        ],
      },
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    docs: {
      theme: theming.create({
        base: 'light',
        fontBase: '"Noto Sans JP", "BIZ UD Gothic", sans-serif',
        fontCode: '"Cascadia Mono", "BIZ UD Gothic", monospace',
      })
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;