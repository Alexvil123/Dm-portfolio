const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const vm = require('node:vm');
const { createAuditHandler } = require('../lib/audit-form');
const valid = { name: 'Test Lead', business: 'Test Business', email: 'test@example.com', phone: '+918220000000', city: 'Chennai', service: 'Google Ads & PPC Management', requestId: 'test-request-1234567890' };
const settings = { url: 'https://script.google.com/macros/s/test-deployment/exec', secret: 'test-only-secret' };

async function fixture(t, options = {}) {
  const handler = createAuditHandler({ getConfig: () => settings, logger: { warn() {} }, ...options });
  const server = http.createServer(async (req, res) => {
    if (options.parsedBody) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      req.body = options.parsedBody === 'string' ? raw : JSON.parse(raw);
    }
    return handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (body, extra = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/audit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...extra.headers }, body: JSON.stringify(body), ...extra,
  });
}
test('unconfigured form fails honestly without forwarding personal data', async t => {
  const post = await fixture(t, { getConfig: () => ({}), fetchImpl: () => assert.fail('must not forward') });
  const result = await post(valid);
  assert.equal(result.status, 503);
  assert.equal((await result.json()).ok, false);
});
test('only a matching confirmed save produces success', async t => {
  const forwarded = [];
  const post = await fixture(t, { fetchImpl: async (url, options) => {
    forwarded.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ ok: true, requestId: valid.requestId }) };
  } });
  const response = await post(valid);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, requestId: valid.requestId });
  assert.equal(forwarded[0].secret, settings.secret);
  assert.equal(forwarded[0].phone, valid.phone);
});
test('Google failures and mismatched acknowledgements never show success', async t => {
  for (const result of [{ ok: false }, { ok: true, requestId: 'different-request' }]) {
    const post = await fixture(t, { fetchImpl: async () => ({ ok: true, json: async () => result }) });
    assert.equal((await post(valid)).status, 502);
  }
});
test('Vercel parsed object and string bodies both save through the same API', async t => {
  for (const parsedBody of ['object', 'string']) {
    const post = await fixture(t, { parsedBody, fetchImpl: async (url, options) => {
      const forwarded = JSON.parse(options.body);
      assert.equal(forwarded.name, valid.name);
      return { ok: true, json: async () => ({ ok: true, requestId: forwarded.requestId }) };
    } });
    assert.equal((await post(valid)).status, 200);
  }
});
test('a lost response after saving retries the same ID and receives the existing receipt', async t => {
  const rows = new Map();
  const bodies = [];
  const diagnostics = [];
  const post = await fixture(t, {
    logger: { warn: (...args) => diagnostics.push(args) },
    fetchImpl: async (url, options) => {
      bodies.push(options.body);
      const request = JSON.parse(options.body);
      if (!rows.has(request.requestId)) rows.set(request.requestId, request);
      if (bodies.length === 1) throw new DOMException('Save completed but receipt was delayed', 'TimeoutError');
      return { ok: true, json: async () => ({ ok: true, requestId: request.requestId }) };
    },
  });
  const response = await post(valid);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).requestId, valid.requestId);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(rows.size, 1);
  assert.equal(diagnostics[0][1].reason, 'timeout');
  assert.equal(JSON.stringify(diagnostics).includes(valid.email), false);
  assert.equal(JSON.stringify(diagnostics).includes(settings.secret), false);
});
test('a failed confirmation retry stays an error instead of claiming success', async t => {
  let attempts = 0;
  const post = await fixture(t, { fetchImpl: async () => {
    attempts++;
    throw new DOMException('Timeout', 'TimeoutError');
  } });
  const result = await post(valid);
  assert.equal(result.status, 502);
  assert.equal((await result.json()).ok, false);
  assert.equal(attempts, 2);
});
test('validation, spam trap and foreign origins are rejected before Google', async t => {
  const post = await fixture(t, { fetchImpl: () => assert.fail('must not forward') });
  for (const input of [{ ...valid, email: 'wrong' }, { ...valid, phone: '123' }, { ...valid, website: 'spam' }, { ...valid, business: '' }, null]) {
    assert.equal((await post(input)).status, 400);
  }
  assert.equal((await post(valid, { headers: { Origin: 'https://another.example', 'Content-Type': 'application/json' } })).status, 403);
});
test('repeated attempts are rate limited', async t => {
  const post = await fixture(t, { fetchImpl: () => assert.fail('invalid email must not forward') });
  for (let i = 0; i < 10; i++) assert.equal((await post({ ...valid, email: 'invalid' })).status, 400);
  assert.equal((await post(valid)).status, 429);
});
test('Apps Script preserves literal text, records once on retry, rejects wrong secrets', () => {
  const rows = [['headers']];
  const sheet = {
    getLastRow: () => rows.length,
    getRange: (row, col) => ({
      setNumberFormat() { return this; },
      setValues(values) { rows[row - 1] = values[0]; return this; },
      createTextFinder(id) { return { matchEntireCell() { return this; }, findNext() { return rows.some(r => r[7] === "'" + id) ? {} : null; } }; },
    }),
  };
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, hasLock: () => true, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'FORM_SECRET' ? settings.secret : 'test-sheet' }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(fs.readFileSync('integrations/google-sheets/Code.gs', 'utf8'), context);
  const input = { ...valid, name: '=HYPERLINK("https://example.com")', secret: settings.secret };
  const event = value => ({ postData: { contents: JSON.stringify(value) } });
  assert.equal(context.doPost(event(input)).ok, true);
  assert.equal(context.doPost(event(input)).ok, true);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], "'" + input.name);
  assert.equal(rows[1][4], "'" + input.phone);
  assert.equal(context.doPost(event({ ...input, secret: 'wrong' })).ok, false);
  assert.equal(context.doGet().ok, false);
});
