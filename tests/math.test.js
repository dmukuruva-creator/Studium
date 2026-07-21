#!/usr/bin/env node
// _mathNormalize unit tests — run with: node tests/math.test.js
// _mathNormalize is the single funnel every .math-rich node routes its raw text
// through, so full-LaTeX bank content (\textbf{}, bare \frac, \\) renders while
// $…$ still hands off to KaTeX auto-render. These tests pin that contract.
// Functions are EXTRACTED from studium.html at runtime (no copy/paste drift).

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

eval(grab('esc'));
eval(grab('_mathNormalize'));

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('  FAIL: ' + name); }
}

// ── Core bug: document-level LaTeX must not leak raw ────────────────────────
t('null/undefined -> empty string', _mathNormalize(null) === '' && _mathNormalize(undefined) === '');
t('\\textbf -> <strong>', _mathNormalize('\\textbf{Answer.}') === '<strong>Answer.</strong>');
t('\\textit/\\emph -> <em>', _mathNormalize('\\textit{a}\\emph{b}') === '<em>a</em><em>b</em>');

// The exact SEQ-020 card from the reported screenshot no longer leaks backslashes.
(function () {
  var out = _mathNormalize('\\textbf{Answer.} $N$. First letters of the number names: One, ..., \\textbf{N}ine.');
  t('screenshot case: no raw \\textbf leaks', out.indexOf('\\textbf') === -1);
  t('screenshot case: bold rendered', out.indexOf('<strong>Answer.</strong>') === 0 && out.indexOf('<strong>N</strong>ine') !== -1);
  t('screenshot case: $N$ preserved for KaTeX', out.indexOf('$N$') !== -1);
})();

// ── Delimited math is protected verbatim ───────────────────────────────────
t('inline $...$ passes through', _mathNormalize('value is $x^2$ ok').indexOf('$x^2$') !== -1);
t('display $$...$$ passes through', _mathNormalize('$$\\int_0^1 x\\,dx$$').indexOf('$$\\int_0^1 x\\,dx$$') !== -1);
t('\\(...\\) passes through', _mathNormalize('a \\(y_i\\) b').indexOf('\\(y_i\\)') !== -1);
t('protected math is not HTML-mangled', _mathNormalize('$a_b$').indexOf('$a_b$') !== -1);

// ── Bare macros (no delimiters) get wrapped so KaTeX picks them up ──────────
t('bare \\frac wrapped', _mathNormalize('half is \\frac12 done').indexOf('\\(\\frac12\\)') !== -1);
t('bare \\sqrt wrapped', _mathNormalize('\\sqrt{2}').indexOf('\\(\\sqrt{2}\\)') !== -1);
t('longer command not falsely wrapped', _mathNormalize('\\fraction').indexOf('\\(') === -1);

// ── Escaped dollar is a literal, never a delimiter ─────────────────────────
(function () {
  var out = _mathNormalize('cost \\$5 and \\$10');
  t('\\$ -> literal $ span', out.indexOf('<span class="tex-literal">$</span>5') !== -1);
  t('\\$ is not treated as a math delimiter', out.indexOf('\\(') === -1 && out.indexOf('$5 and $10') === -1);
})();

// ── HTML-safety: plain-text <, >, & are escaped (parity with esc) ───────────
t('plain < > & escaped', _mathNormalize('a < b & c > d') === 'a &lt; b &amp; c &gt; d');
t('no raw script survives', _mathNormalize('<script>x</script>').indexOf('<script>') === -1);

// ── Inline math with comparison operators can't inject a stray tag ─────────
(function () {
  var out = _mathNormalize('prob $P(a<b)$ here');
  t('inline math < is entity-escaped', out.indexOf('$P(a&lt;b)$') !== -1);
  t('inline math injects no raw <b tag', out.indexOf('<b)') === -1);
})();

// ── LaTeX structure -> HTML ────────────────────────────────────────────────
t('\\\\ -> <br>', _mathNormalize('line1 \\\\ line2').indexOf('<br>') !== -1);
t('\\par -> double <br>', _mathNormalize('a \\par b').indexOf('<br><br>') !== -1);
t('\\% -> %', _mathNormalize('50\\% sure') === '50% sure');
t('~ -> space (LaTeX hard space)', _mathNormalize('a~b') === 'a b');

console.log('\nmath.test.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
