import type { Preview } from '@storybook/react-vite'
import './preview.css'
import * as theming from 'storybook/theming';

const preview: Preview = {
  parameters: {
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