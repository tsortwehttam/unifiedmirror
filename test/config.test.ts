import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"
import {
  resolveConfigDirs,
  resolveTokenWritePathForAccount,
  setPwdConfigDir,
} from "../src/config/CliConfig"

test("resolveConfigDirs includes .unifiedmirror roots", () => {
  let base = path.resolve("/tmp/unifiedmirror-config-test")
  setPwdConfigDir(path.resolve(base, ".unifiedmirror"))
  let dirs = resolveConfigDirs()
  assert.ok(dirs.some(value => value.endsWith(`${path.sep}.unifiedmirror`)))
})

test("resolveTokenWritePathForAccount writes to .unifiedmirror by default", () => {
  let base = path.resolve("/tmp/unifiedmirror-config-test-write")
  setPwdConfigDir(path.resolve(base, ".unifiedmirror"))
  let value = resolveTokenWritePathForAccount("work", "gmail")
  assert.equal(value, path.resolve(base, ".unifiedmirror", "gmail", "tokens", "work.json"))
})
