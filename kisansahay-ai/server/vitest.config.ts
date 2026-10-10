import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 20000,
    fileParallelism: false,
    env: {
      CLINE_MODE: "fixture",
      MANDI_MODE: "snapshot",
      WEATHER_MODE: "cached",
      LLM_PROVIDER: "none",
      DEMO_NOW: "2026-10-10T02:00:00+05:30",
    },
  },
});
