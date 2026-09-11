import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // .tsx as well as .ts. This pattern used to be '*.test.ts' alone, which
    // meant a component test was silently never collected: the file sat in the
    // repo, vitest reported green, and nothing in it had run. Any narrowing
    // here must keep .tsx, or component coverage becomes unprovable again.
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
