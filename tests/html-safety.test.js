'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .map((match, index) => ({
    attributes: match[1] || '',
    source: match[2] || '',
    index: index + 1,
  }))
  .filter(script => !/\bsrc\s*=/i.test(script.attributes) && script.source.trim());

test('all inline JavaScript blocks parse without syntax errors', () => {
  assert.ok(scripts.length > 0, 'No inline JavaScript blocks were found');
  const failures = [];

  for (const script of scripts) {
    const isModule = /\btype\s*=\s*["']module["']/i.test(script.attributes);
    const args = ['--check'];
    if (isModule) args.push('--input-type=module');

    const result = spawnSync(process.execPath, args, {
      input: script.source,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.error || result.status !== 0) {
      failures.push([
        'Inline script #' + script.index + (isModule ? ' (module)' : ''),
        result.error ? result.error.message : (result.stderr || result.stdout || 'Unknown parser error'),
      ].join('\n'));
    }
  }

  assert.deepEqual(failures, [], failures.join('\n\n'));
});

test('the app loads the shared financial core and the single same-origin worker', () => {
  assert.match(html, /<script\s+src=["']\.\/finance-core\.js["']/i);
  assert.match(html, /serviceWorker\.register\(["']\.\/sw\.js["']/);
  assert.doesNotMatch(html, /const\s+CACHE\s*=\s*['"]financeOS-v46['"]/);
});

test('browser code does not contain direct Anthropic API endpoints', () => {
  assert.doesNotMatch(html, /https:\/\/api\.anthropic\.com\/v1\/messages/i);
  assert.match(html, /AI Advisor\s*·\s*Not connected/);
});

test('backup import validates the payload before replacing stored state', () => {
  assert.match(html, /FinanceOSCore\.validateBackup\(parsed\)/);
  assert.match(html, /DB\.save\(parsed,\s*\{\s*force:\s*true\s*\}\)/);
});
