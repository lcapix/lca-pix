/** Values the global setup hands to every test worker (vitest provide/inject). */
export interface TestDbConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  /** The lcapix_t_* database built for this run. */
  database: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    testDb: TestDbConfig;
    /** true when tests/e2e-local runs in this suite too (pnpm test:db:e2e-local). */
    e2eLocal: boolean;
  }
}
