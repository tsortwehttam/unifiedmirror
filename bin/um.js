#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
let entry = path.resolve(root, "src/cli/index.ts")
let require = createRequire(import.meta.url)
let tsxRoot = path.dirname(require.resolve("tsx/package.json"))
let tsx = path.resolve(tsxRoot, "dist/cli.mjs")

let child = spawn(process.execPath, [tsx, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
})

child.on("exit", code => {
  process.exit(code ?? 1)
})
