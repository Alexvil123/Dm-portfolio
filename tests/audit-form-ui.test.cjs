const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup({ fetchResult, reducedMotion = false, confettiFails = false } = {}) {
  const classList = () => {
    const names = new Set();
    return { add: name => names.add(name), remove: name => names.delete(name), contains: name => names.has(name) };
  };
  const fields = Object.fromEntries(Object.entries({ cName:'Test Lead', cBusiness:'Test Company', cEmail:'test@example.com', cPhone:'9999999999', cCity:'Chennai', cService:'Google Ads Management', cWebsite:'' })
    .map(([id, value]) => [id, { value, disabled: false, focus() {} }]));
  let onSubmit;
  let bursts = 0;
  const label = { textContent: 'Request My Free Audit' };
  const button = { disabled:false, classList:classList(), querySelector: () => label };
  const error = { hidden:true, textContent:'' };
  const success = { classList:classList(), focus() {}, getBoundingClientRect: () => ({ left:100, top:100, width:350 }) };
  const form = {
    classList:classList(), style:{}, reportValidity: () => true,
    addEventListener: (type, callback) => { onSubmit = callback; },
    querySelectorAll: () => Object.values(fields), setAttribute() {}, removeAttribute() {},
    reset: () => Object.values(fields).forEach(field => { field.value = ''; }),
  };
  const elements = { ...fields, contactForm:form, celebrateBox:success, btnSubmitContact:button, contactFormError:error };
  const bodies = [];
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    crypto: { randomUUID: () => 'test-request-id-1234567890' },
    AbortController, setTimeout, clearTimeout,
    window: { innerWidth:1200, innerHeight:900, matchMedia: () => ({ matches:reducedMotion }), confetti() { bursts++; if (confettiFails) throw Error('Canvas unavailable'); } },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body); bodies.push(body);
      return fetchResult ? fetchResult(body) : { ok:true, json:async () => ({ ok:true, requestId:body.requestId }) };
    },
  });
  const source = fs.readFileSync('js/main.js', 'utf8');
  const start = source.indexOf('function initAuditContactForm() {');
  const end = source.indexOf('function initMobileNavigation()', start);
  vm.runInContext(source.slice(start, end), context);
  context.initAuditContactForm();
  return { fields, form, button, label, error, success, bodies, context, bursts: () => bursts,
    submit: () => onSubmit({ preventDefault() {} }) };
}

test('click starts loading and prevents duplicate submits; celebration waits for the receipt', async () => {
  let resolveSave;
  const fixture = setup({ fetchResult: body => new Promise(resolve => {
    resolveSave = () => resolve({ ok:true, json:async () => ({ ok:true, requestId:body.requestId }) });
  }) });
  const saving = fixture.submit();
  assert.equal(fixture.button.disabled, true);
  assert.equal(fixture.button.classList.contains('is-submitting'), true);
  assert.equal(fixture.form.classList.contains('is-submitting'), true);
  assert.equal(Object.values(fixture.fields).every(field => field.disabled), true);
  assert.equal(fixture.bursts(), 0);
  assert.equal(fixture.success.classList.contains('show'), false);
  await fixture.submit();
  assert.equal(fixture.bodies.length, 1);
  resolveSave(); await saving;
  assert.equal(fixture.success.classList.contains('show'), true);
  assert.equal(fixture.bursts(), 1);
  assert.equal(fixture.form.style.display, 'none');
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.form.classList.contains('is-submitting'), false);
});
test('failure stops loading, retains details and reuses the request ID on retry', async () => {
  let tries = 0;
  const fixture = setup({ fetchResult: async body => ++tries === 1
    ? { ok:false, json:async () => ({ ok:false, message:'Confirmation unavailable' }) }
    : { ok:true, json:async () => ({ ok:true, requestId:body.requestId }) } });
  await fixture.submit();
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.bursts(), 0);
  assert.equal(fixture.fields.cName.value, 'Test Lead');
  assert.equal(fixture.fields.cName.disabled, false);
  assert.equal(fixture.button.classList.contains('is-submitting'), false);
  await fixture.submit();
  assert.equal(fixture.bodies[0].requestId, fixture.bodies[1].requestId);
  assert.equal(fixture.success.classList.contains('show'), true);
});
test('reduced motion skips confetti and a broken canvas never reports a saved request as failed', async () => {
  const quiet = setup({ reducedMotion:true });
  await quiet.submit();
  assert.equal(quiet.bursts(), 0);
  assert.equal(quiet.success.classList.contains('show'), true);
  const broken = setup({ confettiFails:true });
  await broken.submit();
  assert.equal(broken.success.classList.contains('show'), true);
  assert.equal(broken.error.hidden, true);
});
