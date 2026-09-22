import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// この設定は GitHub 経由でインストールされたときの prepare（npm run build）でも読み込まれる。
// ビルドに不要なパッケージ（Storybook, Vitest, Playwright など）をここで import すると
// 利用側の環境によっては設定ファイルの読み込み自体に失敗するため、
// テスト関連の設定は vitest.config.ts に分けている。
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
      entry: path.resolve(__dirname, 'src/EditableGrid/index.ts'),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'index'
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', '@tanstack/react-table', '@tanstack/react-virtual']
    },
  }
});
