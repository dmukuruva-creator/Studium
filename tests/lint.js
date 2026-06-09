#!/usr/bin/env node
// Static integrity lint for studium.html — run with: node tests/lint.js
// Catches the bug classes seen in development: JS syntax errors, broken inline
// event handlers (e.g. an undefined `e` vs `event`), getElementById targets that
// are never created, typo'd S.<field> access, and duplicate function definitions.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'studium.html'), 'utf8');
let failures = 0;
function ok(label) { console.log('  ok   ' + label); }
function bad(label, lines) { failures++; console.error('  FAIL ' + label); (lines || []).forEach(function (l) { console.error('         ' + l); }); }

// 1) JS syntax — compile every inline (non-module, non-src) <script> block.
(function () {
  const blocks = [...SRC.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="module")[^>]*>([\s\S]*?)<\/script>/g)].map(function (m) { return m[1]; });
  const js = blocks.join('\n;\n');
  try { new vm.Script(js); ok('JS syntax (' + blocks.length + ' inline block(s), ' + js.length + ' chars)'); }
  catch (e) { bad('JS syntax', [e.message]); }
})();

// 2) No duplicate top-level function declarations.
(function () {
  const names = [...SRC.matchAll(/^function ([a-zA-Z_$][\w$]*)/gm)].map(function (m) { return m[1]; });
  const seen = {}, dups = [];
  names.forEach(function (n) { seen[n] = (seen[n] || 0) + 1; if (seen[n] === 2) dups.push(n); });
  dups.length ? bad('duplicate function definitions', dups) : ok('no duplicate function definitions (' + names.length + ' top-level)');
})();

// 3) Inline-handler integrity — every fn called from on*="..." must be declared.
(function () {
  const declared = new Set([...SRC.matchAll(/\bfunction\s+([a-zA-Z_$][\w$]*)/g)].map(function (m) { return m[1]; }));
  [...SRC.matchAll(/\b(?:var|const|let)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:function|\()/g)].forEach(function (m) { declared.add(m[1]); });
  const skip = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'do', 'else', 'await', 'new', 'delete', 'void', 'in', 'of', 'instanceof', 'render', 'toast', 'confirm', 'alert', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'parseInt', 'parseFloat', 'event']);
  const handlers = [...SRC.matchAll(/\bon(?:click|input|change|keydown|keyup|mousedown|mouseup|mouseleave|dragover|dragleave|drop|submit)\s*=\s*"([^"]*)"/g)].map(function (m) { return m[1]; });
  const missing = {};
  handlers.forEach(function (h) {
    [...h.matchAll(/([a-zA-Z_$][\w$]*)\s*\(/g)].forEach(function (m) {
      const fn = m[1], before = h.slice(Math.max(0, m.index - 1), m.index);
      if (skip.has(fn) || before === '.') return;
      if (!declared.has(fn)) missing[fn] = (missing[fn] || 0) + 1;
    });
  });
  const keys = Object.keys(missing);
  keys.length ? bad('inline-handler targets not defined', keys.map(function (k) { return k + ' (x' + missing[k] + ')'; }))
              : ok('inline-handler integrity (' + handlers.length + ' handlers, ' + declared.size + ' fns)');
})();

// 4) getElementById targets — every literal id looked up must be created somewhere.
(function () {
  const refs = new Set([...SRC.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(function (m) { return m[1]; }));
  function created(id) { return SRC.includes('id="' + id + '"') || SRC.includes("id='" + id + "'") || SRC.includes('id="' + id); }
  const missing = [...refs].filter(function (id) { return !created(id); });
  missing.length ? bad('getElementById targets never created', missing.map(function (i) { return '#' + i; }))
                 : ok('getElementById integrity (' + refs.size + ' ids)');
})();

// 5) State-field integrity — every S.<field> read must be a declared key or an
//    assignment target (catches typos like S.quantBnaks).
(function () {
  const lit = SRC.match(/const S = \{([\s\S]*?)\n\};/);
  const keys = new Set();
  if (lit) { [...lit[1].matchAll(/(?:^|\n)\s*([a-zA-Z_$][\w$]*)\s*:/g)].forEach(function (m) { keys.add(m[1]); }); }
  [...SRC.matchAll(/\bS\.([a-zA-Z_$][\w$]*)\s*=/g)].forEach(function (m) { keys.add(m[1]); });
  const reads = new Set([...SRC.matchAll(/\bS\.([a-zA-Z_$][\w$]*)/g)].map(function (m) { return m[1]; }));
  const undef = [...reads].filter(function (k) { return !keys.has(k); });
  undef.length ? bad('S.<field> accessed but never declared/assigned', undef.map(function (k) { return 'S.' + k; }))
              : ok('state-field integrity (' + keys.size + ' keys, ' + reads.size + ' accessed)');
})();

console.log('\nlint.js: ' + (failures ? failures + ' check(s) FAILED' : 'all checks passed'));
process.exit(failures ? 1 : 0);
