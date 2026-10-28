import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      // `include` is set in angular.json (`coverageInclude`), not here: the unit-test builder
      // only adds the globs for its bundled spec/chunk files when the include comes from there.
      // With an include here alone, executed code is dropped before source-map remapping (0 %).
      exclude: [
        'src/app/**/*.spec.ts',
        'src/app/**/testing/**',
        'src/test-setup.ts',
        'src/app/app.config.ts',
        'src/app/app.routes.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        'src/app/engine/**': { lines: 95, statements: 95, functions: 95, branches: 95 },
        'src/app/state/**': { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
