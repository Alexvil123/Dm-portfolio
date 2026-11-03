const fs = require('node:fs');
const path = require('node:path');

function createAuditHandler({ root, fetchImpl = fetch, getConfig, getClientIp, logger = console } = {}) {
  const attempts = new Map();
  const config = getConfig || (() => {
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(path.join(root, '.audit-config.json'), 'utf8')); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
    return {
      url: process.env.AUDIT_SCRIPT_URL || saved.url,
      secret: process.env.AUDIT_FORM_SECRET || saved.secret,
    };
  });
  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  return async (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, 405, { ok: false, message: 'Please submit the audit form.' });
    }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) throw new Error();
      } catch {
        return send(res, 403, { ok: false, message: 'Please submit from this website.' });
      }
    }
    try {
      const settings = config();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(settings.url || '') || !settings.secret) {
        return send(res, 503, { ok: false, message: 'The audit form is temporarily unavailable. Please contact us by email or WhatsApp.' });
      }
      const ip = getClientIp ? getClientIp(req) : req.socket.remoteAddress;
      const now = Date.now();
      for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
      const usage = attempts.get(ip) || { count: 0, until: now + 15 * 60 * 1000 };
      if (usage.count >= 10 || attempts.size > 10000) {
        return send(res, 429, { ok: false, message: 'Too many requests. Please try again in 15 minutes.' });
      }
      usage.count++;
      attempts.set(ip, usage);
      if (!(req.headers['content-type'] || '').startsWith('application/json')) {
        return send(res, 415, { ok: false, message: 'Please submit the form again.' });
      }
      // Vercel can supply a parsed body; the local server supplies a stream.
      let input = req.body;
      if (input === undefined) {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 8192) return send(res, 413, { ok: false, message: 'Your request is too long.' });
        }
        input = raw;
      }
      if (Buffer.isBuffer(input)) input = input.toString('utf8');
      if (typeof input === 'string') {
        try { input = JSON.parse(input); } catch { return send(res, 400, { ok: false, message: 'Please check your form details.' }); }
      }
      if (Buffer.byteLength(JSON.stringify(input) || '') > 8192) return send(res, 413, { ok: false, message: 'Your request is too long.' });
      if (!input || typeof input !== 'object') return send(res, 400, { ok: false, message: 'Please check your form details.' });
      if (input.website) return send(res, 400, { ok: false, message: 'Please submit the form again.' });
      const data = {};
      for (const [key, max] of Object.entries({ name: 100, business: 150, email: 254, phone: 30, city: 100, service: 150, requestId: 80 })) {
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) {
          return send(res, 400, { ok: false, message: 'Please complete all form fields correctly.' });
        }
        data[key] = input[key].trim();
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
          !/^[0-9+ ()-]+$/.test(data.phone) || !/^\d{10,15}$/.test(data.phone.replace(/\D/g, '')) ||
          !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)) {
        return send(res, 400, { ok: false, message: 'Please check your email and phone number.' });
      }
      // Google can save a row before its response times out. Retry the SAME ID:
      // Apps Script's lock and ID lookup return the existing receipt instead of
      // adding a second row. Two 25s attempts fit within Vercel's 60s function.
      const body = JSON.stringify({ ...data, secret: settings.secret });
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetchImpl(settings.url, {
            method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(25000),
            headers: { 'Content-Type': 'application/json' }, body,
          });
          const result = await response.json();
          if (!response.ok || result.ok !== true || result.requestId !== data.requestId) throw new Error('Unconfirmed receipt');
          return send(res, 200, { ok: true, requestId: data.requestId });
        } catch (error) {
          // Diagnostic metadata only: never log submitted details or secrets.
          logger.warn('audit_confirmation_unavailable', {
            requestId: data.requestId, attempt,
            reason: ['AbortError', 'TimeoutError'].includes(error.name) ? 'timeout' : 'upstream_response',
          });
        }
      }
      throw new Error('Save not confirmed after retry');
    } catch {
      return send(res, 502, { ok: false, message: 'We could not confirm your request was saved. Please retry; your details are still here.' });
    }
  };
}
module.exports = { createAuditHandler };
