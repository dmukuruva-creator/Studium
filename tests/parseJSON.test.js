#!/usr/bin/env node
// parseJSON (pj) unit tests — runnable with: node tests/parseJSON.test.js
'use strict';

// ── Copy of pj() from studium.html ──────────────────────────────────────────
function pj(t) {
  if (t && typeof t !== 'string') return t;
  function clean(s) { return s.trim().replace(/^```(?:json)?[\r\n]*/i, '').replace(/[\r\n]*```\s*$/i, '').trim(); }
  function repair(s) {
    return s.replace(/,\s*([}\]])/g, '$1').replace(/}\s*{/g, '},{').replace(/]\s*\[/g, '],[');
  }
  function balanced(s) {
    var start = s.search(/[\[{]/);
    if (start < 0) return '';
    var open = s[start], close = open === '[' ? ']' : '}';
    var depth = 0, inStr = false, escd = false;
    for (var i = start; i < s.length; i++) {
      var ch = s[i];
      if (inStr) {
        if (escd) escd = false;
        else if (ch === '\\') escd = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close && --depth === 0) return s.slice(start, i + 1);
    }
    return s.slice(start);
  }

  var s = clean(t), variants = [s];
  var m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m) variants.push(clean(m[1]));
  var b = balanced(s);
  if (b) variants.push(b);
  var tries = variants.concat(variants.map(repair));
  for (var i = 0; i < tries.length; i++) {
    try { return JSON.parse(tries[i]); } catch {}
  }
  var objText = repair(b || s);
  var objs = objText.match(/\{[\s\S]*?\}(?=\s*,|\s*\]|\s*$)/g);
  if (objs && objs.length) {
    var parsed = objs.map(function(o) { try { return JSON.parse(repair(o)); } catch { return null; } }).filter(Boolean);
    if (parsed.length) return parsed;
  }
  throw new Error('Could not parse model response as JSON');
}

// ── Test harness ─────────────────────────────────────────────────────────────
var passed = 0, failed = 0;

function assert(label, actual, check) {
  try {
    check(actual);
    console.log('  PASS', label);
    passed++;
  } catch (e) {
    console.error('  FAIL', label, '—', e.message);
    console.error('    got:', JSON.stringify(actual));
    failed++;
  }
}

function eq(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function isArr(v) { if (!Array.isArray(v)) throw new Error('expected array'); }
function len(v, n) { if (v.length !== n) throw new Error('expected length ' + n + ' got ' + v.length); }

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\npj() — clean JSON array');
assert('plain array', pj('[{"a":1}]'), function(v) { isArr(v); len(v, 1); eq(v[0].a, 1); });

console.log('\npj() — markdown code-fence stripping');
assert('```json fence', pj('```json\n[{"q":"test"}]\n```'), function(v) { isArr(v); len(v, 1); eq(v[0].q, 'test'); });
assert('``` fence', pj('```\n{"x":2}\n```'), function(v) { eq(v.x, 2); });

console.log('\npj() — trailing-comma repair');
assert('trailing comma in object', pj('[{"a":1,}]'), function(v) { isArr(v); eq(v[0].a, 1); });
assert('trailing comma in array', pj('{"x":[1,2,]}'), function(v) { eq(v.x.length, 2); });

console.log('\npj() — prose wrapper');
assert('leading prose ignored', pj('Sure! Here is the JSON:\n[{"q":"hi"}]'), function(v) { isArr(v); eq(v[0].q, 'hi'); });
assert('trailing prose ignored', pj('[{"q":"hi"}]\nHope that helps!'), function(v) { isArr(v); });

console.log('\npj() — truncated JSON (balanced extraction)');
assert('truncated mid-array — recovers complete first item', pj('[{"a":1},{"b":2'),  function(v) { isArr(v); len(v, 1); eq(v[0].a, 1); });
assert('object with trailing junk', pj('{"key":"val"} some trailing prose'), function(v) { eq(v.key, 'val'); });

console.log('\npj() — JSON object (non-array)');
assert('plain object', pj('{"score":3,"feedback":"good"}'), function(v) { eq(v.score, 3); eq(v.feedback, 'good'); });
assert('object input', pj({score:3, feedback:'good'}), function(v) { eq(v.score, 3); eq(v.feedback, 'good'); });

console.log('\npj() — error case');
try {
  pj('This is not JSON at all and contains no brackets');
  console.error('  FAIL should have thrown'); failed++;
} catch (e) {
  console.log('  PASS throws on un-parseable input');
  passed++;
}

console.log('\npj() — nested / complex structures');
assert('nested array in object', pj('{"items":[{"q":"hi"},{"q":"bye"}]}'), function(v) { eq(v.items.length, 2); });
assert('deeply nested numbers', pj('[{"score":3,"feedback":"ok","modelAnswer":"yes"}]'), function(v) { isArr(v); eq(v[0].score, 3); });

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
