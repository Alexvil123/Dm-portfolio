const { createAuditHandler } = require('../lib/audit-form');

module.exports = createAuditHandler({
  // Use only Vercel server settings; never package the local secret file.
  getConfig: () => ({ url: process.env.AUDIT_SCRIPT_URL, secret: process.env.AUDIT_FORM_SECRET }),
  // Vercel overwrites this header at its edge; local server ignores it.
  getClientIp: req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(),
});
