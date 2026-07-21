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
eval(grab('_quantItemKey'));
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
eval(grab('_quantHistoryRows'));
eval(grab('_csvCell'));
eval(grab('_quantHistoryCSV'));
eval(grab('_isoWeekKey'));
eval(grab('_weekDrillAcc'));

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
// Braceless TeX fraction shorthand (\tfrac13, \tfrac32) is idiomatic across the
// QuantGuide bank; the extractor must expand it, or correct fraction answers fail
// silently (regression: QG-316 "sharpe-marbles" marked a correct 1/3 as wrong).
t('grade: braceless tfrac answer (QG-316)', gradeQuantAnswer({ a: "$\\mathrm{Var}(A)=\\tfrac32$, $\\mathrm{Var}(B)=1$, so $A_r=\\tfrac23$, $B_r=1$ and $B_r-A_r=\\tfrac13$. \\par\\textbf{Answer.} $\\tfrac13$." }, '1/3').correct === true);
t('grade: braceless frac answer as decimal', gradeQuantAnswer({ a: '\\textbf{Answer.} $\\tfrac12$.' }, '0.5').correct === true);
t('grade: mixed braceless/braced frac', gradeQuantAnswer({ a: '\\textbf{Answer.} $\\tfrac1{10}$.' }, '0.1').correct === true);

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
// Unseen-this-session first: idx=0 already shown; 1 & 3 shown; only 2 is unseen —
// must always pick 2 until the pool is exhausted (fixes "repeats despite seen").
t('pick: exhausts unseen-this-session before repeating', (function () {
  var sess = { items: [{}, {}, {}, {}], idx: 0, stats: { 0: { sessionSeen: 1 }, 1: { sessionSeen: 1 }, 3: { sessionSeen: 1 } } };
  for (var i = 0; i < 200; i++) { if (_quantPickNext(sess) !== 2) return false; } return true;
})());
// Once everything's been seen this session, it recycles (weighted) instead of stalling.
t('pick: recycles after full pool seen', (function () {
  var sess = { items: [{}, {}, {}], idx: 0, stats: { 0: { sessionSeen: 1 }, 1: { sessionSeen: 1 }, 2: { sessionSeen: 1 } } };
  var n = _quantPickNext(sess); return n === 1 || n === 2; // never idx (0)
})());

// ── _quantItemKey (stable cross-session identity) ────────────────────────────
t('itemKey: uses id when present', _quantItemKey({ id: 'QG-316', q: 'whatever' }) === 'id:QG-316');
t('itemKey: falls back to normalized question stem', _quantItemKey({ q: 'What is 1/2 + 1/2?' }) === _quantItemKey({ q: 'what is 1/2 + 1/2?' }));
t('itemKey: different questions differ', _quantItemKey({ q: 'foo' }) !== _quantItemKey({ q: 'bar' }));

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

// ── weekly checkpoints (new) ─────────────────────────────────────────────────
t('isoWeek: 2026-06-30 (Tue) is week 27', _isoWeekKey(new Date(Date.UTC(2026, 5, 30))) === '2026-W27');
t('isoWeek: zero-pads single-digit weeks', _isoWeekKey(new Date(Date.UTC(2026, 0, 5))) === '2026-W02');
t('isoWeek: Jan 1 2027 (Fri) belongs to 2026-W53', _isoWeekKey(new Date(Date.UTC(2027, 0, 1))) === '2026-W53');
t('weekDrillAcc: aggregates only the matching ISO week', (function () {
  var wk = _isoWeekKey(new Date(Date.UTC(2026, 5, 30)));
  var inWeek = Date.UTC(2026, 5, 30), outWeek = Date.UTC(2026, 5, 1);
  var log = [
    { ts: inWeek,  answered: 10, correct: 7 },
    { ts: inWeek,  answered: 10, correct: 8 },
    { ts: outWeek, answered: 10, correct: 0 },   // different week — excluded
  ];
  var r = _weekDrillAcc(log, wk);
  return r.answered === 20 && r.correct === 15 && r.acc === 75;
})());
t('weekDrillAcc: no drills this week → null acc, safe on empty', (function () {
  var r = _weekDrillAcc([], '2026-W27'), r2 = _weekDrillAcc(null, '2026-W27');
  return r.answered === 0 && r.acc === null && r2.answered === 0 && r2.acc === null;
})());

// ── drill history + export (new) ─────────────────────────────────────────────
const HIST_LOG = [
  { ts: Date.UTC(2026, 5, 20, 12), bank: 'Green Book, "Ch.2"', scope: { topic: 'Probability', difficulty: 'Hard' }, answered: 10, correct: 8, skipped: 1, qpm: 5, avgSec: 11.2 },
  { ts: Date.UTC(2026, 5, 21, 12), bank: 'Zetamac', scope: {}, answered: 0, correct: 0, skipped: 2, qpm: 0, avgSec: 0 },
];
t('history: rows carry accuracy + scope', (function () {
  var r = _quantHistoryRows(HIST_LOG);
  return r.length === 2 && r[0].accuracy === 80 && r[0].topic === 'Probability' && r[0].difficulty === 'Hard';
})());
t('history: zero answered → null accuracy (no divide-by-zero)', (function () {
  var r = _quantHistoryRows(HIST_LOG);
  return r[1].accuracy === null && r[1].skipped === 2;
})());
t('history: empty/garbage input is safe', _quantHistoryRows(null).length === 0 && _quantHistoryRows([{}]).length === 1);
t('csvCell: quotes commas and doubles inner quotes', _csvCell('a,"b"') === '"a,""b"""' && _csvCell('plain') === 'plain' && _csvCell(null) === '');
t('historyCSV: header + one line per session', (function () {
  var lines = _quantHistoryCSV(HIST_LOG).split('\n');
  return lines.length === 3 && lines[0].indexOf('date,bank,topic') === 0;
})());
t('historyCSV: bank name with comma/quotes survives round-trip cell quoting', (function () {
  var line = _quantHistoryCSV(HIST_LOG).split('\n')[1];
  return line.indexOf('"Green Book, ""Ch.2"""') >= 0;
})());

// ── Next-interview countdown (_prepCountdown) ────────────────────────────────
eval(grab('_prepMs'));
eval(grab('_prepPlaybooks'));
eval(grab('_prepCountdown'));
const CD_NOW = Date.UTC(2026, 6, 14, 15); // 2026-07-14 mid-day
t('countdown: null/absent input → null', _prepCountdown(null, CD_NOW) === null && _prepCountdown({}, CD_NOW) === null);
t('countdown: same-day → days 0 and day-of focus', (function () {
  var c = _prepCountdown({ date: '2026-07-14', stage: 'oa' }, CD_NOW);
  return c.days === 0 && !c.stale && !c.far && c.focus.indexOf('Warm up') === 0;
})());
t('countdown: T-3 phone picks the mock row, T-7 the drill row', (function () {
  var a = _prepCountdown({ date: '2026-07-17', stage: 'phone' }, CD_NOW);
  var b = _prepCountdown({ date: '2026-07-21', stage: 'phone' }, CD_NOW);
  return a.days === 3 && a.focus.indexOf('Mock 1') >= 0 && b.days === 7 && b.focus.indexOf('Firm-tag drill') === 0;
})());
t('countdown: beyond the playbook horizon → far, standing-loop fallback', (function () {
  var c = _prepCountdown({ date: '2026-08-14', stage: 'superday' }, CD_NOW);
  return c.days === 31 && c.far && !c.stale && c.focus.indexOf('T-7') >= 0;
})());
t('countdown: past date → stale + debrief prompt', (function () {
  var c = _prepCountdown({ date: '2026-07-10', stage: 'mm' }, CD_NOW);
  return c.stale && c.days < 0 && c.focus.indexOf('debrief') >= 0;
})());
t('countdown: unknown stage falls back to phone playbook', (function () {
  var c = _prepCountdown({ date: '2026-07-15', stage: 'zzz' }, CD_NOW);
  return c.label === 'Probability phone screen' && c.days === 1;
})());
t('countdown: OA battery (oab) label + T-minus rows', (function () {
  var far = _prepCountdown({ date: '2026-07-19', stage: 'oab' }, CD_NOW); // T-5 blind spots
  var reh = _prepCountdown({ date: '2026-07-15', stage: 'oab' }, CD_NOW); // T-1 dress rehearsal
  var sit = _prepCountdown({ date: '2026-07-14', stage: 'oab' }, CD_NOW); // T-0 warm up
  return far.label === 'Quant OA battery (Optiver-style)' && far.days === 5 && far.focus.indexOf('blind spots') >= 0
    && reh.days === 1 && reh.focus.indexOf('dress rehearsal') >= 0
    && sit.days === 0 && sit.focus.indexOf('Warm up') === 0;
})());
t('countdown: oab beyond T-5 horizon → far', (function () {
  var c = _prepCountdown({ date: '2026-07-25', stage: 'oab' }, CD_NOW);
  return c.days === 11 && c.far && !c.stale;
})());

// ── Attention layer (_attentionSummary) ─────────────────────────────────────
eval(grab('_attentionSummary'));
t('attention: empty → count 0, urgency none, no top', (function () {
  var s = _attentionSummary([]);
  return s.count === 0 && s.now === 0 && s.top === null && s.urgency === 'none';
})());
t('attention: summary reads first item as top + counts now-urgency', (function () {
  var s = _attentionSummary([{ urgency: 'now', label: 'a' }, { urgency: 'soon', label: 'b' }, { urgency: 'now', label: 'c' }]);
  return s.count === 3 && s.now === 2 && s.top.label === 'a' && s.urgency === 'now';
})());
t('attention: null-safe + non-now top', (function () {
  var s = _attentionSummary(null), s2 = _attentionSummary([{ urgency: 'soon', label: 'x' }]);
  return s.count === 0 && s2.urgency === 'soon' && s2.now === 0;
})());

// ── Pomodoro pure helpers ────────────────────────────────────────────────────
eval(grab('_pomoFormat'));
eval(grab('_pomoNext'));
eval(grab('_pomoStats'));
var POMO_CFG = { focus: 25, short: 5, long: 15, longEvery: 4, sound: true };
t('pomo: format mm:ss (floor/clamp)', _pomoFormat(1500000) === '25:00' && _pomoFormat(65000) === '01:05' && _pomoFormat(-10) === '00:00' && _pomoFormat(5000) === '00:05');
t('pomo: focus → short on non-4th round, → long on 4th', (function () {
  var a = _pomoNext('focus', 1, POMO_CFG), b = _pomoNext('focus', 4, POMO_CFG);
  return a.mode === 'short' && a.round === 1 && b.mode === 'long' && b.round === 4;
})());
t('pomo: break → focus advances the round', (function () {
  var a = _pomoNext('short', 2, POMO_CFG), b = _pomoNext('long', 4, POMO_CFG);
  return a.mode === 'focus' && a.round === 3 && b.mode === 'focus' && b.round === 5;
})());
t('pomo: stats split today vs all-time', (function () {
  var now = Date.UTC(2026, 6, 20, 15), dayAgo = now - 26 * 3600e3;
  var s = _pomoStats([{ ts: now - 3600e3, min: 25 }, { ts: now - 60e3, min: 25 }, { ts: dayAgo, min: 25 }], now);
  return s.todaySessions === 2 && s.todayMin === 50 && s.totalSessions === 3 && s.totalMin === 75;
})());
t('pomo: stats null-safe', (function () { var s = _pomoStats(null, Date.now()); return s.totalSessions === 0 && s.todayMin === 0; })());

console.log('\nquant.test.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
