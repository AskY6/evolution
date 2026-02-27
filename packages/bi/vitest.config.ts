import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["../../tests/bi/**/*.test.ts"],
  },
});
