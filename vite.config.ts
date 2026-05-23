import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: false, // keep explicit imports: import { describe, it, expect } from 'vitest'
  },
});