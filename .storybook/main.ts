import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp"
  ],
  "framework": "@storybook/react-vite",

  // Storybook のアプリケーションに適用される Vite の設定をカスタマイズする関数
  viteFinal: async (config) => {
    const tailwindcss = (await import('@tailwindcss/vite')).default
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    return config
  }
};
export default config;