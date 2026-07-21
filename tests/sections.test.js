#!/usr/bin/env node
// headingMatches / _looksLikeHeading unit tests — run: node tests/sections.test.js
// PDF text extraction of a real book (e.g. "The Quant Compendium") emits printed
// table-of-contents lines, ALL-CAPS running page-headers repeated on every page,
// numeric data/table rows, and code as pseudo-headings. Left unchecked, one book
// explodes into hundreds of bogus "sections" that flood every section <select>.
// These tests pin the heading detector's discipline. Functions are EXTRACTED
// from studium.html at runtime (no copy/paste drift).

const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'studium.html'), 'utf8');

function grab(name) {
  const re = new RegExp('\\nfunction ' + name + '\\s*\\(');
  const i = SRC.search(re);
  if (i < 0) throw new Error('Could not find function ' + name + ' in studium.html');
  const from = i + 1;
  const nxt = SRC.indexOf('\nfunction ', from + 10);
  return SRC.slice(from, nxt < 0 ? SRC.length : nxt);
}

eval(grab('_looksLikeHeading'));
eval(grab('headingMatches'));

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name); } }

// ── _looksLikeHeading: rejects the three PDF pseudo-heading classes ─────────
t('accepts a prose title', _looksLikeHeading('The Limit Order Book') === true);
t('accepts ALL-CAPS chapter title', _looksLikeHeading('CHAPTER 5. CORE TERMINOLOGY') === true);
t('rejects ToC dot-leaders (spaced)', _looksLikeHeading('Where Does the Edge Come From? . . . . . 12') === false);
t('rejects ToC dot-leaders (solid)', _looksLikeHeading('Private Equity ...... 64') === false);
t('rejects ellipsis leader', _looksLikeHeading('Commodities … 12') === false);
t('rejects pure number row', _looksLikeHeading('500') === false);
t('rejects multi-number data row', _looksLikeHeading('1500 0 1500 3000') === false);
t('rejects decimal data row', _looksLikeHeading('0.08 0.1 0.12 0.14 0.16') === false);
t('rejects assignment code', _looksLikeHeading('signal = pd.DataFrame(index=rank.index)') === false);
t('rejects import code', _looksLikeHeading('import pandas as pd , numpy as np') === false);
t('rejects code comment w/ operators', _looksLikeHeading('252 trading days ~ 12 months ; 21 trading days') === false);
t('allows short real heading', _looksLikeHeading('Adverse Selection') === true);
t('rejects too-short', _looksLikeHeading('ok') === false);

// ── Regression: column/hyphenation fragments and code lines that used to flood
//    the Study Scope dropdown of a PDF-extracted book (see screenshots 2026-07-19)
t('rejects lowercase hyphenation fragment "nance"', _looksLikeHeading('nance') === false);
t('rejects lowercase hyphenation fragment "erence"', _looksLikeHeading('erence') === false);
t('rejects mid-word fragment "ing Ladder"', _looksLikeHeading('ing Ladder') === false);
t('rejects fragment with trailing paren "perity 4)"', _looksLikeHeading('perity 4)') === false);
t('rejects relational-operator line', _looksLikeHeading('z > + 2: go short the spread') === false);
t('rejects Python block colon', _looksLikeHeading('class Trader :') === false);
t('rejects snake_case code line', _looksLikeHeading('if best_bid and best_ask :') === false);
t('rejects tokenised call punctuation', _looksLikeHeading('if buy_size > 0: orders . append ( Order )') === false);
t('rejects ≤ operator', _looksLikeHeading('if T ≤ 0 or sigma ≤ 0:') === false);
t('rejects lowercase formula fragment', _looksLikeHeading('(neutral) FV – FV + 2 (symmetric)') === false);
// ── Regression: real headings that contain ordinary English "keywords" must
//    survive — the fix must not blanket-reject for/and/in/is/or as if they were code
t('keeps heading with "and"', _looksLikeHeading('Calls and Puts') === true);
t('keeps heading with "in"', _looksLikeHeading('Linear Regression in Finance') === true);
t('keeps em-dash heading', _looksLikeHeading('Volatility Regime Detection — GARCH') === true);
t('keeps parenthetical heading', _looksLikeHeading('Pairs Trading (Statistical Arbitrage)') === true);
t('keeps colon-in-middle heading', _looksLikeHeading('Options and the Greeks: A Complete Reference') === true);

// ── headingMatches: end-to-end on Quant-Compendium-like extracted text ──────
const sample = [
  'The Limit Order Book',
  'CHAPTER 4. HIGH-FREQUENCY TRADING AND MARKET MICROSTRUCTURE',
  'x 300 ← BEST ASK',
  'BID (BUY) SIDE',
  'CHAPTER 4. HIGH-FREQUENCY TRADING AND MARKET MICROSTRUCTURE',
  '500',
  '1100',
  '1500 0 1500 3000',
  'The Square-Root Law of Market Impact',
  'CHAPTER 4. HIGH-FREQUENCY TRADING AND MARKET MICROSTRUCTURE',
  '0.08 0.1 0.12 0.14 0.16 0.18 0.2',
  'import pandas as pd , numpy as np',
  '# 252 trading days ~ 12 months ; 21 trading days ~ 1 month',
  'signal = pd . DataFrame (0.0 , index = rank . index)',
  'CHAPTER 4. HIGH-FREQUENCY TRADING AND MARKET MICROSTRUCTURE',
  'CHAPTER 5. CORE TERMINOLOGY',
  'Performance Metrics',
].join('\n');

const secs = headingMatches(sample);
const titles = secs.map(function (s) { return s.title; });

t('no data/code/ToC survives', !titles.some(function (x) {
  return /^\d[\d\s.]*$/.test(x) || /[=~]/.test(x) || /\.{3,}|(?:\.\s){2,}/.test(x);
}));
t('running page-header collapses to one', titles.filter(function (x) {
  return x === 'CHAPTER 4. HIGH-FREQUENCY TRADING AND MARKET MICROSTRUCTURE';
}).length === 1);
// Only markdown / numbered / "Chapter X" / ALL-CAPS lines are headings by
// design; mixed-case prose lines are body text, not headings.
t('real chapter headings kept', titles.indexOf('CHAPTER 5. CORE TERMINOLOGY') >= 0
  && titles.indexOf('BID (BUY) SIDE') >= 0);
t('section count is sane (not a flood)', secs.length <= 5);

// ── Regression: normal markdown headings are untouched ─────────────────────
const md = headingMatches('# Intro\nsome text\n## Details\nmore\n## Details\neven more');
t('markdown headings still parse', md.length === 3 && md[0].title === 'Intro' && md[1].level === 2);
t('markdown dup <=3x kept (not a page-header)', md.filter(function (s) { return s.title === 'Details'; }).length === 2);

console.log('\nsections.test.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
