/// <reference types="vite/client" />

declare module '@data/ats/*.json' {
  const value: Record<string, unknown> & { meta: unknown };
  export default value;
}
