const { defineConfig } = require("@playwright/test")

const baseURL = process.env.BASE_URL || "http://127.0.0.1:4000"

if (!process.env.BASE_URL) {
  process.env.PERF_KEEP_TOKEN ||= "playwright"
}

module.exports = defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.js",
  timeout: 150_000,
  expect: { timeout: 15_000 },
  // One worker so a shard does not paint several pages at once. fullyParallel
  // lets --shard split a file. The beforeAll hook would otherwise keep the
  // whole file on one runner.
  fullyParallel: true,
  workers: 1,
  projects: [
    { name: "functional", testIgnore: "**/perf.spec.js" },
    { name: "perf", testMatch: "**/perf.spec.js" }
  ],
  outputDir: "tmp/playwright-output",
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
      args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"]
    }
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "mix phx.server",
        url: "http://127.0.0.1:4000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          PLAYWRIGHT: "1",
          PERF_KEEP_TOKEN: process.env.PERF_KEEP_TOKEN
        }
      }
})
