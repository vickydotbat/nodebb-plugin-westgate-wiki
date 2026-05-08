"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const composeController = fs.readFileSync(path.join(__dirname, "..", "lib/controllers/compose.js"), "utf8");
const composePageJs = fs.readFileSync(path.join(__dirname, "..", "public/wiki-compose-page.js"), "utf8");
const libraryJs = fs.readFileSync(path.join(__dirname, "..", "library.js"), "utf8");

assert.match(composeController, /const wikiEditLocks = require\("\.\.\/wiki-edit-locks"\)/);
assert.match(composeController, /const editLock = await wikiEditLocks\.acquireLock\(topic\.tid, req\.uid\)/);
assert.match(composeController, /editLockUrl: `\$\{relativePath\}\/api\/v3\/plugins\/westgate-wiki\/edit-lock`/);
assert.match(composeController, /editLockToken: editLock\.token/);
assert.match(composeController, /editLockTtlMs: editLock\.ttlMs/);

assert.match(libraryJs, /const wikiEditLocks = require\("\.\/lib\/wiki-edit-locks"\)/);
assert.match(libraryJs, /"\/westgate-wiki\/edit-lock"/);
assert.match(libraryJs, /wikiEditLocks\.putEditLock/);
assert.match(libraryJs, /wikiEditLocks\.deleteEditLock/);

assert.match(composePageJs, /let editLockRefreshTimer = null/);
assert.match(composePageJs, /function startEditLockHeartbeat\(\)/);
assert.match(composePageJs, /method: method[\s\S]*token: payload\.editLockToken/);
assert.match(composePageJs, /sendEditLockRequest\("PUT"\)/);
assert.match(composePageJs, /sendEditLockRequest\("DELETE"\)/);
assert.match(composePageJs, /postEditUrl\.searchParams\.set\("wikiEditLockToken", payload\.editLockToken \|\| ""\)/);
assert.match(composePageJs, /wikiEditLockToken: payload\.editLockToken/);

console.log("wiki-edit-lock client tests passed");
