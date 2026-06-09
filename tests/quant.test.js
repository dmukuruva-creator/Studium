#!/usr/bin/env node
// Quant Drill + grading/interleave unit tests — run with: node tests/quant.test.js
// Functions are EXTRACTED from studium.html at runtime (single source of truth —
// no copy/paste drift). If studium.html moves these functions, the test follows.
// NOTE: intentionally NOT strict-mode — direct eval() below must introduce the
// extracted function declarations into this module's scope for the tests to call.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'studium.html'), 'utf8');

// Grab a top-level `function NAME(...) {...}` by slicing from its declaration to
// the next top-level `\nfunction ` (every target here is a column-0 declaration).
function grab(name) {
  const re = new RegExp('\\nfunction ' + name + '\\s*\\(');
  const i = SRC.search(re);
  if (i < 0) throw new Error('Could not find function ' + name + ' in studium.html');
  const from = i + 1;
  const nxt = SRC.indexOf('\nfunction ', from + 10);
  return SRC.slice(from, nxt < 0 ? SRC.length : nxt);
}

// Load the pure functions under test into this scope.
eval(grab('_normalizeCloze'));
eval(grab('_tryNumericGrade'));
eval(grab('gradeCloze'));
eval(grab('_quantToNumber'));
eval(grab('gradeQuantAnswer'));
eval(grab('parseQuantBank'));
eval(grab('_quantPickNext'));
eval(grab('_interleaveByTopic'));

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL: ' + name); }
}

// ── deterministic graders (existing) ─────────────────────────────────────────
t('cloze: case/space-insensitive match', gradeCloze({ blank: 'eigen value' }, '  Eigen  Value ').score === 3);
t('cloze: wrong', gradeCloze({ blank: 'x' }, 'y').score === 0);
t('numeric: exact', _tryNumericGrade({ answer: '42' }, '42').score === 3);
t('numeric: within 0.1%', _tryNumericGrade({ answer: '1000' }, '1000.5').score === 3);
t('numeric: off', _tryNumericGrade({ answer: '1000' }, '1100').score === 0);
t('numeric: word -> null (defers to LLM)', _tryNumericGrade({ answer: 'spleen' }, 'x') === null);

// ── _quantToNumber ───────────────────────────────────────────────────────────
t('toNumber: integer', _quantToNumber('2491') === 2491);
t('toNumber: decimal', Math.abs(_quantToNumber('0.1667') - 0.1667) < 1e-9);
t('toNumber: fraction', Math.abs(_quantToNumber('1/6') - 1 / 6) < 1e-9);
t('toNumber: percent', _quantToNumber('50%') === 0.5);
t('toNumber: commas', _quantToNumber('1,000') === 1000);
t('toNumber: word -> null', _quantToNumber('spleen') === null);
t('toNumber: empty -> null', _quantToNumber('') === null);
t('toNumber: divide-by-zero -> null', _quantToNumber('1/0') === null);

// ── gradeQuantAnswer ─────────────────────────────────────────────────────────
t('grade: integer exact', gradeQuantAnswer({ a: '2491' }, '2491').correct === true);
t('grade: integer off rejected (no rounding for ints)', gradeQuantAnswer({ a: '2491' }, '2490').correct === false);
t('grade: fraction vs decimal', gradeQuantAnswer({ a: '1/6' }, '0.1667').correct === true);
t('grade: decimal rounding tolerance', gradeQuantAnswer({ a: '0.1667' }, '0.167').correct === true);
t('grade: percent vs fraction', gradeQuantAnswer({ a: '1/2' }, '50%').correct === true);
t('grade: word match', gradeQuantAnswer({ a: 'Bayes' }, '  bayes ').correct === true);
t('grade: wrong word', gradeQuantAnswer({ a: 'Bayes' }, 'Markov').correct === false);
t('grade: empty answer wrong', gradeQuantAnswer({ a: '4' }, '').correct === false);

// ── parseQuantBank ───────────────────────────────────────────────────────────
t('parse: JSON {q,a}', parseQuantBank('[{"q":"2+2","a":"4"}]').length === 1);
t('parse: JSON {question,answer}', parseQuantBank('[{"question":"x","answer":"y"}]')[0].a === 'y');
t('parse: pipe-delimited', (function () { var r = parseQuantBank('47*53 | 2491\nP(H) | 1/2'); return r.length === 2 && r[0].a === '2491' && r[1].a === '1/2'; })());
t('parse: tab-delimited', parseQuantBank('a\t1\nb\t2').length === 2);
t('parse: Q:/A: blocks', (function () { var r = parseQuantBank('Q: what is 2+2?\nA: 4\nQ: 3*3\nA: 9'); return r.length === 2 && r[1].a === '9'; })());
t('parse: => delimiter', parseQuantBank('5! => 120')[0].a === '120');
t('parse: empty -> []', parseQuantBank('   ').length === 0);
t('parse: keeps commas inside the question', parseQuantBank('what is 2,3,4 | 9')[0].q === 'what is 2,3,4');
t('parse: junk line -> skipped', parseQuantBank('no delimiter here').length === 0);

// ── _quantPickNext (weighted sampler; uses Math.random) ──────────────────────
t('pick: single item -> 0', _quantPickNext({ items: [{}], idx: 0, stats: {} }) === 0);
t('pick: 2 items never repeats last', (function () { for (var i = 0; i < 80; i++) if (_quantPickNext({ items: [{}, {}], idx: 0, stats: {} }) === 0) return false; return true; })());
t('pick: in range, never the previous index', (function () { for (var i = 0; i < 300; i++) { var n = _quantPickNext({ items: [{}, {}, {}, {}], idx: 1, stats: {} }); if (n < 0 || n > 3 || n === 1) return false; } return true; })());

// ── _interleaveByTopic ───────────────────────────────────────────────────────
t('interleave: preserves count', _interleaveByTopic([{ t: 'a' }, { t: 'a' }, { t: 'b' }, { t: 'b' }], function (x) { return x.t; }).length === 4);
t('interleave: spreads topics', (function () { var r = _interleaveByTopic([{ t: 'a' }, { t: 'a' }, { t: 'b' }, { t: 'b' }], function (x) { return x.t; }); return r[0].t !== r[1].t && r[2].t !== r[3].t; })());
t('interleave: single topic intact', _interleaveByTopic([{ t: 'a' }, { t: 'a' }], function (x) { return x.t; }).length === 2);

console.log('\nquant.test.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
