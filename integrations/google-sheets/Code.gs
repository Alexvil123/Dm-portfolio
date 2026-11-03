// Paste into the Apps Script project bound to your Free Audit spreadsheet.
// Configure SPREADSHEET_ID and FORM_SECRET in Project Settings > Script properties.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!e || !e.postData || e.postData.contents.length > 10000) throw new Error('Invalid request');
    var data = JSON.parse(e.postData.contents);
    var settings = PropertiesService.getScriptProperties();
    var secret = settings.getProperty('FORM_SECRET');
    if (!secret || data.secret !== secret) throw new Error('Unauthorized');
    var keys = ['name', 'business', 'email', 'phone', 'city', 'service', 'requestId'];
    var limits = [100, 150, 254, 30, 100, 150, 80];
    keys.forEach(function (key, i) {
      if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > limits[i]) throw new Error('Invalid field');
      data[key] = data[key].trim();
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
        !/^[0-9+ ()-]+$/.test(data.phone) || !/^\d{10,15}$/.test(data.phone.replace(/\D/g, '')) ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)) throw new Error('Invalid details');
    lock.waitLock(15000);
    var sheet = SpreadsheetApp.openById(settings.getProperty('SPREADSHEET_ID')).getSheetByName('Audit Requests');
    if (!sheet) throw new Error('Missing sheet');
    var last = sheet.getLastRow();
    // A retry after a slow response must not create a second enquiry.
    if (last > 1 && sheet.getRange(2, 8, last - 1, 1).createTextFinder(data.requestId).matchEntireCell(true).findNext()) {
      return auditJson_({ ok: true, requestId: data.requestId });
    }
    var row = last + 1;
    // Store all visitor-supplied values as text, including +91 phone numbers.
    var values = [data.name, data.business, data.email, data.phone, data.city, data.service, data.requestId]
      .map(function (value) { return "'" + value; });
    sheet.getRange(row, 1).setNumberFormat('dd mmm yyyy hh:mm:ss');
    sheet.getRange(row, 2, 1, 7).setNumberFormat('@');
    sheet.getRange(row, 1, 1, 8).setValues([[new Date()].concat(values)]);
    SpreadsheetApp.flush();
    return auditJson_({ ok: true, requestId: data.requestId });
  } catch (error) {
    return auditJson_({ ok: false });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function auditJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

// Opening the deployment URL never exposes enquiries.
function doGet() {
  return auditJson_({ ok: false, message: 'Submit through the Free Audit form.' });
}
