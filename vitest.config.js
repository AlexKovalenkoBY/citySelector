import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url))
    },
    build: {
      rollupOptions: {
        input: {
          main: 'distr/vcard.html', // Укажите путь к вашему vcard.html
        },
        // entryFileNames: 'vcard.html', // Указываем имя файла для сборки
      },
    },
  })
)

