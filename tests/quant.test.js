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
eval(grab('_quantNumberCandidates'));
eval(grab('_quantTextContainsAnswer'));
eval(grab('gradeQuantAnswer'));
eval(grab('_quantList'));
eval(grab('_quantItemFromObject'));
eval(grab('_parseQuantCsv'));
eval(grab('parseQuantBank'));
eval(grab('_quantPickNext'));
eval(grab('_quantTopicHint'));
eval(grab('_quantConfidenceLabel'));
eval(grab('_quantSkillScore'));
eval(grab('_quantTrend'));
eval(grab('_quantPriority'));
eval(grab('_quantBankTopics'));
eval(grab('_quantCoverage'));
eval(grab('_quantReadingFor'));
eval(grab('_quantThemeCovered'));
eval(grab('_quantNewThemes'));
eval(grab('_parseThemeNames'));
eval(grab('_quantAnalytics'));
eval(grab('_quantRecommendation'));
eval(grab('_interleaveByTopic'));
eval(grab('_quantSessionBreakdown'));

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
t('grade: numeric answer can match final value inside worked solution', gradeQuantAnswer({ a: 'There are $\\binom{24}{2}=276$ ways. So $P=\\dfrac{12}{276}=\\dfrac{1}{23}$.' }, '1/23').correct === true);
t('grade: short text answer can match answer sentence inside worked solution', gradeQuantAnswer({ a: 'The simple answer is no. Sine and cosine are periodic.' }, 'no').correct === true);

// ── parseQuantBank ───────────────────────────────────────────────────────────
t('parse: JSON {q,a}', parseQuantBank('[{"q":"2+2","a":"4"}]').length === 1);
t('parse: JSON {question,answer}', parseQuantBank('[{"question":"x","answer":"y"}]')[0].a === 'y');
t('parse: JSON {question,solution}', (function () { var r = parseQuantBank('[{"id":"QC-03","question":"socks?","solution":"1/23","topic":"Probability","tracks":["trader"]},{"question":"empty","solution":""}]'); return r.length === 1 && r[0].a === '1/23' && r[0].topic === 'Probability' && r[0].tracks[0] === 'trader'; })());
t('parse: JSONL problem bank rows', parseQuantBank('{"question":"x","solution":"1"}\n{"question":"y","solution":"2"}').length === 2);
t('parse: CSV problem bank rows', (function () { var r = parseQuantBank('id,question,solution,topic\nA,"what, now?",42,Arithmetic'); return r.length === 1 && r[0].q === 'what, now?' && r[0].a === '42' && r[0].topic === 'Arithmetic'; })());
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

// ── Quant analytics / recommendations ───────────────────────────────────────
t('hint: topic-specific Bayes hint', /conditioning/.test(_quantTopicHint({ topic: 'Bayes' })));
t('confidence label: guess', _quantConfidenceLabel('guess') === 'Guess');
t('skill score: weak row below strong row', _quantSkillScore({ seen: 10, correct: 5, avgSec: 90, unsure: 4, skips: 1 }) < _quantSkillScore({ seen: 10, correct: 9, avgSec: 20, unsure: 0, skips: 0 }));
global.S = {
  quantBanks: [{ id: 1, name: 'Bank', items: [{ topic: 'Probability' }] }],
  quantLog: [
    { ts: 1, byTopic: { Probability: { seen: 8, correct: 4, ms: 480000, unsure: 3, guess: 1, skips: 1 } }, byDifficulty: { Hard: { seen: 8, correct: 4 } } }
  ]
};
t('analytics: aggregates topic accuracy and pace', (function () { var a = _quantAnalytics(); return a.topics[0].topic === 'Probability' && a.topics[0].acc === 50 && a.topics[0].avgSec === 60; })());
t('recommendation: weak topic repair', _quantRecommendation().kind === 'topic' && _quantRecommendation().topic === 'Probability');

// ── trend (accuracy trajectory) ──────────────────────────────────────────────
t('trend: improving across sessions -> positive', _quantTrend([{ seen: 5, correct: 1 }, { seen: 5, correct: 5 }]) === 80);
t('trend: slipping across sessions -> negative', _quantTrend([{ seen: 5, correct: 5 }, { seen: 5, correct: 1 }]) === -80);
t('trend: thin total sample -> null', _quantTrend([{ seen: 2, correct: 1 }, { seen: 2, correct: 2 }]) === null);
t('trend: single session -> null', _quantTrend([{ seen: 10, correct: 5 }]) === null);

// ── priority (impact × urgency) ──────────────────────────────────────────────
t('priority: stale weak topic outranks fresh strong topic', (function () {
  var stale = _quantPriority({ seen: 10, correct: 5, acc: 50, skill: 30, daysSince: 14, trend: null, wrongSure: 0 });
  var fresh = _quantPriority({ seen: 10, correct: 9, acc: 90, skill: 83, daysSince: 1, trend: null, wrongSure: 0 });
  return stale.score > fresh.score && stale.urgent === true && fresh.urgent === false;
})());
t('priority: decay shows in the reason', /stale 14d/.test(_quantPriority({ seen: 10, correct: 9, acc: 90, skill: 83, daysSince: 14, trend: null, wrongSure: 0 }).reason));
t('priority: confident misses flag urgency', (function () { var p = _quantPriority({ seen: 10, correct: 7, acc: 70, skill: 65, daysSince: 1, trend: null, wrongSure: 2 }); return p.urgent === true && /confident miss/.test(p.reason); })());
t('priority: improving topic eases off', _quantPriority({ seen: 10, correct: 7, acc: 70, skill: 70, daysSince: 1, trend: 15, wrongSure: 0 }).score < _quantPriority({ seen: 10, correct: 7, acc: 70, skill: 70, daysSince: 1, trend: null, wrongSure: 0 }).score);

// ── recommendation branches: overconfidence + decay ──────────────────────────
t('recommendation: overconfidence beats raw accuracy', (function () {
  global.S = { quantBanks: [{ id: 1, items: [{ topic: 'Probability' }] }], quantLog: [
    { ts: Date.now(), byTopic: { Probability: { seen: 10, correct: 5, ms: 200000, wrongSure: 3 } } }
  ] };
  var r = _quantRecommendation(); return r.kind === 'calibration' && r.topic === 'Probability';
})());
t('recommendation: strong-but-stale topic gets a refresh', (function () {
  global.S = { quantBanks: [{ id: 1, items: [{ topic: 'Combinatorics' }] }], quantLog: [
    { ts: Date.now() - 14 * 864e5, byTopic: { Combinatorics: { seen: 10, correct: 9, ms: 150000 } } }
  ] };
  var r = _quantRecommendation(); return r.kind === 'decay' && r.topic === 'Combinatorics';
})());
t('analytics: counts urgent topics and captures overconfidence', (function () {
  global.S = { quantBanks: [{ id: 1, items: [] }], quantLog: [
    { ts: Date.now(), byTopic: { Probability: { seen: 10, correct: 4, ms: 300000, wrongSure: 2 } } }
  ] };
  var a = _quantAnalytics(); return a.urgentCount >= 1 && a.topics[0].wrongSure === 2;
})());

// ── coverage gap ─────────────────────────────────────────────────────────────
t('bankTopics: distinct, excludes catch-all buckets', (function () {
  global.S = { quantBanks: [{ id: 1, items: [{ topic: 'Probability' }, { topic: 'Probability' }, { topic: 'Combinatorics' }, { topic: '(untagged)' }, {}] }] };
  var ts = _quantBankTopics(); return ts.length === 2 && ts.indexOf('Probability') >= 0 && ts.indexOf('Combinatorics') >= 0;
})());
t('coverage: flags never-drilled topics', (function () {
  var cov = _quantCoverage([{ topic: 'Probability', seen: 12 }], ['Probability', 'Combinatorics', 'Markov Chains']);
  return cov.untouched.length === 2 && cov.untouched.indexOf('Combinatorics') >= 0 && cov.drilled === 1 && cov.total === 3;
})());
t('coverage: none untouched when all drilled', _quantCoverage([{ topic: 'A', seen: 3 }, { topic: 'B', seen: 1 }], ['A', 'B']).untouched.length === 0);
t('recommendation: coverage gap when nothing weak/stale', (function () {
  global.S = { quantBanks: [{ id: 1, items: [{ topic: 'Probability' }, { topic: 'Options' }] }], quantLog: [
    { ts: Date.now(), byTopic: { Probability: { seen: 20, correct: 19, ms: 200000 } } }
  ] };
  var r = _quantRecommendation(); return r.kind === 'coverage' && r.topic === 'Options';
})());

// ── targeted further reading ─────────────────────────────────────────────────
t('reading: probability -> Green Book / Blitzstein', /Green Book|Blitzstein/.test(_quantReadingFor('Probability')));
t('reading: combinatorics -> Mosteller', /Mosteller/.test(_quantReadingFor('Combinatorics')));
t('reading: options -> Hull/Natenberg', /Hull|Natenberg/.test(_quantReadingFor('Options')));
t('reading: market making -> Green Book ch.4 / primer', /ch\.4|primer/.test(_quantReadingFor('Market Making')));
t('reading: unknown topic -> empty', _quantReadingFor('Underwater Basket Weaving') === '');

// ── theme capture vs Quant_Themes.tex ────────────────────────────────────────
var THEMES_TEX = '\\section{Theme I --- Linearity of Expectation}\nbody\n\\section{Theme III --- Conditional Probability and Bayesian Updating}\n\\section{Theme VI --- Market Making and Adverse Selection}\n\\end{document}';
t('themeCovered: present phrase -> true', _quantThemeCovered('Conditional Probability', THEMES_TEX) === true);
t('themeCovered: absent phrase -> false', _quantThemeCovered('Combinatorics', THEMES_TEX) === false);
t('themeCovered: too-short topic -> true (never nags)', _quantThemeCovered('EV', THEMES_TEX) === true);
t('newThemes: only uncovered, un-acked topics', (function () {
  var n = _quantNewThemes(['Conditional Probability', 'Combinatorics', 'Markov Chains'], THEMES_TEX, ['markov chains']);
  return n.length === 1 && n[0] === 'Combinatorics';
})());
t('parseThemeNames: extracts section names, drops front matter', (function () {
  var names = _parseThemeNames('\\section{How to Use This Refresher}\n\\section{Theme I --- Linearity of Expectation}\n\\section{Theme VI --- Market Making and Adverse Selection}');
  return names.length === 2 && names[0] === 'Linearity of Expectation' && names[1] === 'Market Making and Adverse Selection';
})());

// ── _interleaveByTopic ───────────────────────────────────────────────────────
t('interleave: preserves count', _interleaveByTopic([{ t: 'a' }, { t: 'a' }, { t: 'b' }, { t: 'b' }], function (x) { return x.t; }).length === 4);
t('interleave: spreads topics', (function () { var r = _interleaveByTopic([{ t: 'a' }, { t: 'a' }, { t: 'b' }, { t: 'b' }], function (x) { return x.t; }); return r[0].t !== r[1].t && r[2].t !== r[3].t; })());
t('interleave: single topic intact', _interleaveByTopic([{ t: 'a' }, { t: 'a' }], function (x) { return x.t; }).length === 2);

// ── _quantSessionBreakdown (end-of-drill analytics) ──────────────────────────
var SESS_ATTEMPTS = [
  { topic: 'Probability', correct: true,  skipped: false, confidence: 'sure' },
  { topic: 'Probability', correct: false, skipped: false, confidence: 'sure' },   // confident miss
  { topic: 'Combinatorics', correct: true, skipped: false, confidence: 'unsure' },
  { topic: 'Combinatorics', correct: false, skipped: false, confidence: 'guess' },
  { topic: 'Probability', correct: false, skipped: true,  confidence: 'guess' },   // skip excluded
];
t('breakdown: skips excluded from topic counts', (function () {
  var b = _quantSessionBreakdown(SESS_ATTEMPTS);
  return b.topics.Probability.seen === 2 && b.topics.Probability.correct === 1;
})());
t('breakdown: per-topic accuracy aggregates correctly', (function () {
  var b = _quantSessionBreakdown(SESS_ATTEMPTS);
  return b.topics.Combinatorics.seen === 2 && b.topics.Combinatorics.correct === 1;
})());
t('breakdown: calibration counts confident misses', (function () {
  var b = _quantSessionBreakdown(SESS_ATTEMPTS);
  return b.sureTotal === 2 && b.sureWrong === 1;
})());
t('breakdown: untagged bucket for missing topic', (function () {
  var b = _quantSessionBreakdown([{ correct: true, skipped: false, confidence: 'unsure' }]);
  return b.topics['(untagged)'].seen === 1 && b.sureTotal === 0;
})());
t('breakdown: empty/garbage input is safe', (function () {
  var b = _quantSessionBreakdown(null);
  return Object.keys(b.topics).length === 0 && b.sureTotal === 0 && b.sureWrong === 0;
})());

console.log('\nquant.test.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
