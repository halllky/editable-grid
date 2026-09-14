import type { StorybookConfig } from '@storybook/react-vite';
import remarkGfm from 'remark-gfm';

const config: StorybookConfig = {
  "stories": [
    "../src/stories/**/*.mdx",
    "../src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",

    // 開発時だけの実験用ページ
    ...(process.env.NODE_ENV === 'development' ? [
      "../src/stories_only-dev/**/*.mdx",
      "../src/stories_only-dev/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    ] : []),
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    {
      // MDX は CommonMark 準拠のため、テーブル記法などの GFM を使うには remark-gfm が必要
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    "@storybook/addon-mcp",
    '@storybook/addon-links',
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