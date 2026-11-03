# Vercel deployment

The website is built into `dist/` using `npm run build`. Only public HTML, CSS, JavaScript, images, posters, logos and web-ready videos are copied. Setup files, original full-size videos, local backups and private configuration are excluded.

The Free Audit form POSTs to `/api/audit`, implemented by `api/audit.js` and `lib/audit-form.js`. Vercel runs this as a Node.js function. A static-only deployment will not support form submissions.

Set these server-only variables on the existing Vercel project for **Production** before deploying:

- `AUDIT_SCRIPT_URL`: the deployed Google Apps Script web app URL ending in `/exec`.
- `AUDIT_FORM_SECRET`: the same secret stored in the Apps Script's `FORM_SECRET` script property. Use Vercel's Secret variable type.

Neither variable is part of browser JavaScript. Never commit `.audit-config.json`, `.env` files, or `audit-private/Code.gs`.

Push the reviewed source to the Vercel-connected production branch. `vercel.json` selects the build command, output directory and API timeout. After deployment, verify the production domain loads the updated website, `/api/audit` responds, and one clearly labelled test enquiry is saved to the Google Sheet before the success message appears. Leave real enquiries intact.

The per-IP request limiter is best effort per function instance; it is not a durable cross-instance spam quota. Apps Script request IDs and locking prevent duplicates from retries within a form session.

If Google's save confirmation times out, the API retries once with the identical request ID and payload. Apps Script acknowledges the existing row on retry. The API allows two 25-second attempts within its 60-second function limit; the browser waits up to 58 seconds and changes its button to “Confirming your request…” after 12 seconds. Success still requires Google's matching receipt. Diagnostic logs contain only request ID, attempt and a fixed error category, never enquiry fields or the secret.

Local checks: `npm test` and `npm run build` on Node 24. For local preview, use `npm start`; the local server reads `.audit-config.json` without bundling it.
