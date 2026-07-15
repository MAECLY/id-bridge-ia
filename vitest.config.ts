import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest() polyfills the `browser` global with an in-memory fake
// (@webext-core/fake-browser), inherits the WXT Vite config and wires the
// `@/` path alias.
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // Restore spies (e.g. vi.spyOn(crypto, 'randomUUID')) to their originals
    // after every test so mocks never leak between cases.
    restoreMocks: true,
  },
});
