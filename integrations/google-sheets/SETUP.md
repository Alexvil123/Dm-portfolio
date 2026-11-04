# Free Audit → Google Sheets

Create a private Google spreadsheet in the account that will own the form integration. Keep its URL and spreadsheet ID in your private deployment configuration.

Tab: `Audit Requests`. Columns: Received at (IST), Name, Business, Email, Phone, City, Service, Request ID.

The Apps Script deployment URL and form secret are configured privately in `.audit-config.json` for local use, or as server-only environment variables in production. Use the steps below for initial setup or a future deployment.

## One-time Google account setup

1. Open the spreadsheet with the Google account that owns it.
2. Select **Extensions → Apps Script**.
3. Replace the starter code with the full contents of the local `audit-private/Code.gs`. This prepared private copy contains this Sheet's ID and its server secret. Do not publish or commit it.
4. Save. Select `configureAudit` in the function dropdown and click **Run**. Review Google's requested spreadsheet permissions and authorize your own script. This stores the Sheet ID and secret in Script Properties. If Google blocks authorization, stop and resolve the account/policy restriction.
5. Select **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the **Web app URL ending in `/exec`**. The endpoint accepts writes authenticated by the server secret. It never returns lead records; the spreadsheet itself remains private.
6. From the project directory run:
   ```powershell
   node integrations/google-sheets/configure.cjs 'PASTE_YOUR_EXEC_URL_HERE'
   ```
   Or send the deployment URL in this chat so it can be configured. No secret needs to be sent in chat.
7. Submit one clearly labelled test enquiry on the local site. Confirm exactly one new row appears in the Sheet and only then the success message appears. Do not delete real enquiries while testing.

Google deployment reference: https://developers.google.com/apps-script/guides/web

## Hosting

Run `node server.js` using Node 20+ (Node 24 recommended). Both `/api/audit` and the website must be served on the same origin. A static-only host cannot run this API; retain the Node backend or port the handler to the hosting provider's serverless function when publishing.

Local secrets are in `.audit-config.json`, ignored by Git and blocked by the server. Production may instead use the server-only environment variables `AUDIT_SCRIPT_URL` and `AUDIT_FORM_SECRET`. Do not place these secrets in browser JavaScript. Copy the secret from the private configuration to the deployment's server settings without committing it. The API's per-IP rate limit uses the direct connection address; behind a reverse proxy configure a trusted-client-IP strategy before increasing public traffic, otherwise requests can share one limit.

## Behaviour and verification

- POST `/api/audit` validates required fields, rejects the hidden spam field, limits repeated requests, and forwards to Apps Script from the server.
- Success requires Google's matching saved request ID. Errors preserve entered details and offer retry.
- A retry with unchanged form details reuses the ID; Apps Script uses a lock and the Request ID column to prevent duplicate rows. Reopening/reloading the page starts a new request.
- Visitor fields are stored as literal text to prevent spreadsheet formula execution and preserve phone formatting.
- The separate Email and WhatsApp links stay available. Form submission does not send an email or WhatsApp message.
- Run `node --test --test-isolation=none tests/audit-form.test.cjs` for local mocked integration tests on Node 24. These do not write to Google or send messages. Real Google end-to-end delivery still requires steps 4–7.
- Frontend backups before this integration are in `audit/sheets-before/`.

For future Apps Script code changes, update the existing deployment via **Deploy → Manage deployments → Edit → New version → Deploy** so its URL remains valid.
