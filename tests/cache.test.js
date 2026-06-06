const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'studium.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Could not locate main script block in studium.html');
const scriptSource = scriptMatch[1];

const sandbox = {
  window: {},
  document: {
    addEventListener: function() {},
    dispatchEvent: function() {},
    getElementById: function() { return null; },
    querySelector: function() { return null; },
    createElement: function() { return { addEventListener: function() {}, style: {}, appendChild: function() {} }; },
  },
  localStorage: {
    _data: {},
    getItem: function(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem: function(key, value) { this._data[key] = String(value); },
    removeItem: function(key) { delete this._data[key]; },
  },
  CustomEvent: function(type, opts) { this.type = type; this.detail = opts && opts.detail; },
  fetch: function() { return Promise.resolve({ ok: false, json: () => Promise.resolve({}) }); },
  Event: function() {},
  URL: { createObjectURL: function() { return ''; } },
  navigator: {},
  console: console,
};
vm.createContext(sandbox);
vm.runInContext(scriptSource, sandbox);
vm.runInContext(
  'globalThis.S = S; globalThis.__S = S; globalThis.__setDocs = setDocs; globalThis.__studySections = studySections; globalThis.__studyContext = studyContext; globalThis.__saveSubjects = saveSubjects; globalThis.saveSubjects = saveSubjects; globalThis.studyContext = studyContext;',
  sandbox
);

// Because the script installs a DOMContentLoaded listener and uses event-driven startup,
// we only exercise the functions that were defined in the sandbox.

function assertSameCacheBehavior() {
  sandbox.__setDocs([
    { name: 'Doc1', content: '# Section 1\nContent 1' },
    { name: 'Doc2', content: '## Section A\nContent A' },
  ]);

  const sectionsA = sandbox.__studySections();
  const sectionsB = sandbox.__studySections();
  assert.strictEqual(sectionsA, sectionsB, 'studySections() should return cached result on repeat call');
  assert.strictEqual(sectionsA.length, 2, 'studySections() should find two sections');

  const contextA = sandbox.__studyContext();
  const contextB = sandbox.__studyContext();
  assert.strictEqual(contextA, contextB, 'studyContext() should return cached result on repeat call');
  assert.strictEqual(contextA.label, 'Full library');

  sandbox.__setDocs([
    { name: 'Doc1', content: '# Section 1\nUpdated content' },
  ]);
  const sectionsC = sandbox.__studySections();
  assert.notStrictEqual(sectionsC, sectionsA, 'studySections() cache should invalidate after setDocs() changes docs');

  sandbox.S.subjects = [{ id: 'subj1', name: 'Subject 1', docNames: ['Doc1'] }];
  sandbox.S.subjectDocKey = 'Doc1';
  sandbox.S.sectionScope = 'subj:subj1';
  sandbox.saveSubjects();

  const subjectContextA = sandbox.studyContext();
  const subjectContextB = sandbox.studyContext();
  assert.strictEqual(subjectContextA, subjectContextB, 'studyContext() should cache subject-scoped results');
  sandbox.S.subjects.push({ id: 'subj2', name: 'Subject 2', docNames: ['Doc2'] });
  sandbox.saveSubjects();
  const subjectContextC = sandbox.studyContext();
  assert.notStrictEqual(subjectContextC, subjectContextB, 'studyContext() should invalidate cache when subjects change');
}

function run() {
  try {
    assertSameCacheBehavior();
    console.log('PASS: cache.test.js passed');
  } catch (err) {
    console.error('FAIL: cache.test.js failed');
    console.error(err);
    process.exit(1);
  }
}

run();
