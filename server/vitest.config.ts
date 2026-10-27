import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [{
    name: "vitest-node-sqlite",
    enforce: "pre",
    resolveId(source) {
      if (source === "node:sqlite") return "\0vitest-node-sqlite"
    },
    load(id) {
      if (id === "\0vitest-node-sqlite") {
        return "const { DatabaseSync } = process.getBuiltinModule('node:sqlite'); export { DatabaseSync }"
      }
    }
  }],
  test: { environment: "node", testTimeout: 30_000, fileParallelism: false, pool: "forks" }
})
