import { defineConfig } from '@playwright/test'

const apiPort = process.env.E2E_API_PORT ?? '8080'
const webPort = process.env.E2E_WEB_PORT ?? '5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${webPort}`, trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'mvn -q -B -f ../backend/pom.xml spring-boot:run',
      env: { PORT: apiPort, FINON_CORS_ORIGINS: `http://localhost:${webPort}` },
      url: `http://localhost:${apiPort}/api/accounts`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --strictPort --port ${webPort}`,
      env: { API_PROXY_TARGET: `http://localhost:${apiPort}` },
      url: `http://localhost:${webPort}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
