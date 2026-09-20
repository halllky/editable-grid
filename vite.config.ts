/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    react(),
    (() => {
      // Vite の lib モードは CSS を dist/index.css に切り出すが、
      // エントリの JS チャンクに import './index.css' を書き込んでくれない。
      // このままだと利用側が dist/index.js を import するだけでは
      // スタイルが一切当たらないため、ビルド後の JS 先頭に import を注入する。
      let isLibBuild = false
      return {
        name: 'eg2-inject-css-import',
        apply: 'build',
        // Storybook はこの vite.config.ts を読み込んだうえで自身のビルドを行うため、
        // 何もしないと Storybook のエントリにも import が注入され、
        // 存在しない index.css を読みに行って画面が表示されなくなる。
        // lib モード（dist のビルド）のときだけ注入する。
        configResolved(config) {
          isLibBuild = !!config.build.lib
        },
        renderChunk(code, chunk) {
          if (!isLibBuild || !chunk.isEntry) return null
          return { code: `import './index.css';\n${code}`, map: null }
        },
      }
    })(),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/EditableGrid2/index.ts'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'index'
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', '@tanstack/react-table', '@tanstack/react-virtual']
    },
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});