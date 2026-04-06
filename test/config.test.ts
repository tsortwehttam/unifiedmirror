import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import {
  resolveConfigDirs,
  resolveTokenWritePathForAccount,
  setPwdConfigDir,
} from "../src/config/CliConfig"

test("resolveConfigDirs prefers .um before legacy .msgmon roots", () => {
  let base = path.resolve("/tmp/um-config-test")
  setPwdConfigDir(path.resolve(base, ".um"))
  let dirs = resolveConfigDirs()
  let umIndex = dirs.findIndex(value => value.endsWith(`${path.sep}.um`))
  let legacyIndex = dirs.findIndex(value => value.endsWith(`${path.sep}.msgmon`))
  assert.notEqual(umIndex, -1)
  assert.notEqual(legacyIndex, -1)
  assert.ok(umIndex < legacyIndex)
})

test("resolveTokenWritePathForAccount writes to .um by default", () => {
  let base = path.resolve("/tmp/um-config-test-write")
  setPwdConfigDir(path.resolve(base, ".um"))
  let value = resolveTokenWritePathForAccount("work", "gmail")
  assert.equal(value, path.resolve(base, ".um", "gmail", "tokens", "work.json"))
})
