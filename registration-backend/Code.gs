/**
 * Reframing Glioblastoma — registration backend (Google Apps Script)
 *
 * Receives the website form, saves each registration as a row in this
 * Google Sheet and sends the participant a confirmation email.
 * Setup instructions: SETUP-REGISTRATION.md
 */

// ---- Settings -------------------------------------------------------------
const EVENT_NAME      = 'Reframing Glioblastoma';
const EVENT_SUBTITLE  = 'Integrating Tumor Biology, Microenvironment and Clinical Perspectives';
const EVENT_DATE      = 'Thursday 18 February 2027';
const EVENT_PLACE     = 'CNR Research Area of Pisa, Via Giuseppe Moruzzi 1, Pisa';
const SITE_URL        = 'https://YOUR-SITE-ADDRESS/';        // shown in the email
const CONTACT_EMAIL   = 'EMAIL1';   // replies to the confirmation email go here (one address)
const ORGANIZER_COPY  = '';  // optional: an address that gets a copy of every registration
const SHEET_NAME      = 'Registrations';
const MAX_WORDS       = 300;
const MAX_PER_EMAIL   = 2;     // registrations allowed with the same email
const MIN_SECONDS     = 4;     // faster than this from page load = bot
// ---------------------------------------------------------------------------

// Column order in the sheet. New columns are added at the end, so a sheet
// created by an earlier version of this script keeps working.
const HEADERS = ['Submitted at', 'First name', 'Last name', 'Email', 'Affiliation',
                 'Attendance', 'Poster', 'Abstract', 'Abstract words', 'Already registered?', 'Confirmation email',
                 'Dietary restrictions / allergies'];
const COL_CONFIRMATION = 11;

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.website) return reply({ ok: true });          // spam trap filled: pretend it worked
    if (!(Number(d.elapsed) >= MIN_SECONDS * 1000)) return reply({ ok: false, error: 'too_fast' });

    const clean = {
      firstName:   text(d.firstName, 80),
      lastName:    text(d.lastName, 80),
      email:       text(d.email, 160).toLowerCase(),
      affiliation: text(d.affiliation, 200),
      attendance:  d.attendance === 'Online' ? 'Online' : (d.attendance === 'In person' ? 'In person' : ''),
      poster:      d.poster === 'Yes' ? 'Yes' : (d.poster === 'No' ? 'No' : ''),
      abstract:    d.poster === 'Yes' ? text(d.abstract, 4000) : '',
      dietary:     text(d.dietary, 300),
    };
    // Posters and lunch are for in-person participants only
    if (clean.attendance === 'Online') { clean.poster = 'No'; clean.abstract = ''; clean.dietary = ''; }
    const error = validate(clean);
    if (error) return reply({ ok: false, error: error });

    let row;
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheet = getSheet();
      const emails = sheet.getLastRow() > 1 ? sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues().flat() : [];
      const previous = emails.filter(function (m) { return String(m).toLowerCase() === clean.email; }).length;
      if (previous >= MAX_PER_EMAIL) return reply({ ok: false, error: 'limit' });
      const duplicate = previous > 0 ? 'Yes' : '';
      sheet.appendRow([new Date(), clean.firstName, clean.lastName, clean.email, clean.affiliation,
                       clean.attendance, clean.poster, clean.abstract, words(clean.abstract), duplicate,
                       '', clean.attendance === 'In person' ? (clean.dietary || 'None') : ''].map(safeCell));
      row = sheet.getLastRow();
    } finally {
      lock.releaseLock();
    }

    // The registration is saved at this point. If an email fails, the participant
    // is still registered: we note it in the sheet instead of reporting an error.
    let emailSent = true;
    try {
      sendConfirmation(clean);
    } catch (mailErr) {
      emailSent = false;
      console.error('Confirmation email failed: ' + mailErr);
    }
    getSheet().getRange(row, COL_CONFIRMATION).setValue(emailSent ? 'Sent' : 'NOT sent: check the email permission');
    if (ORGANIZER_COPY) {
      try {
        MailApp.sendEmail(ORGANIZER_COPY, 'New registration: ' + clean.firstName + ' ' + clean.lastName, summaryText(clean));
      } catch (copyErr) { console.error('Organizer copy failed: ' + copyErr); }
    }
    return reply({ ok: true, emailSent: emailSent });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: 'server' });
  }
}

// Opening the web app URL in a browser shows this: handy to check the deployment works.
function doGet() {
  return ContentService.createTextOutput('Registration endpoint for ' + EVENT_NAME + ' is running.');
}

// ---- helpers ----------------------------------------------------------------
function validate(c) {
  if (!c.firstName || !c.lastName) return 'name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'email';
  if (!c.affiliation) return 'affiliation';
  if (!c.attendance) return 'attendance';
  if (!c.poster) return 'poster';
  if (c.poster === 'Yes' && (words(c.abstract) === 0 || words(c.abstract) > MAX_WORDS)) return 'abstract';
  return '';
}

function words(t) { t = String(t || '').trim(); return t ? t.split(/\s+/).length : 0; }
function text(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max); }
// stop spreadsheet formulas sneaking in from the form
function safeCell(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  } else {
    // sheet made by an older version of this script: add any missing column titles
    HEADERS.forEach(function (title, i) {
      const cell = sheet.getRange(1, i + 1);
      if (!cell.getValue()) cell.setValue(title).setFontWeight('bold');
    });
  }
  return sheet;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function summaryText(c) {
  return [
    'Name: ' + c.firstName + ' ' + c.lastName,
    'Email: ' + c.email,
    'Affiliation: ' + c.affiliation,
    'Attendance: ' + c.attendance,
  ].concat(c.attendance === 'In person' ? ['Dietary restrictions / allergies: ' + (c.dietary || 'None')] : [])
   .concat([
    'Poster: ' + c.poster,
  ]).concat(c.poster === 'Yes' ? ['', 'Abstract:', c.abstract] : []).join('\n');
}

function sendConfirmation(c) {
  const subject = 'Registration confirmed: ' + EVENT_NAME;
  const online = c.attendance === 'Online'
    ? 'You will attend online. We will email you the streaming link a few days before the workshop.'
    : 'You will attend in person at ' + EVENT_PLACE + '. Lunch is offered to in-person participants.';
  const poster = c.poster === 'Yes'
    ? 'We have received your poster abstract. The organizers will let you know whether it has been accepted.'
    : '';

  const plain = [
    'Dear ' + c.firstName + ',', '',
    'thank you for registering for "' + EVENT_NAME + ': ' + EVENT_SUBTITLE + '".', '',
    'Date: ' + EVENT_DATE,
    online, poster, '',
    'Your details:', summaryText(c), '',
    'If anything is wrong, or you can no longer attend, reply to this email.', '',
    'The organizing committee', SITE_URL,
  ].join('\n');

  const row = function (k, v) { return '<tr><td style="padding:4px 16px 4px 0;color:#635A78">' + k + '</td><td style="padding:4px 0">' + esc(v) + '</td></tr>'; };
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1E1530;max-width:560px">' +
    '<p style="font-size:20px;font-weight:bold;margin:0 0 4px">' + esc(EVENT_NAME) + '</p>' +
    '<p style="margin:0 0 24px;color:#635A78">' + esc(EVENT_SUBTITLE) + '</p>' +
    '<p>Dear ' + esc(c.firstName) + ',</p>' +
    '<p>thank you for registering. Your place is confirmed.</p>' +
    '<p><b>Date:</b> ' + esc(EVENT_DATE) + '<br>' + esc(online) + '</p>' +
    (poster ? '<p>' + esc(poster) + '</p>' : '') +
    '<table style="border-collapse:collapse;margin:20px 0;border-top:1px solid #DED7E6;padding-top:8px">' +
      row('Name', c.firstName + ' ' + c.lastName) + row('Email', c.email) + row('Affiliation', c.affiliation) +
      row('Attendance', c.attendance) +
      (c.attendance === 'In person' ? row('Dietary restrictions / allergies', c.dietary || 'None') : '') +
      row('Poster', c.poster) +
    '</table>' +
    (c.poster === 'Yes' ? '<p style="color:#635A78;margin-bottom:4px">Your abstract</p><p style="white-space:pre-wrap;background:#F6F4F8;padding:12px 14px;border-radius:6px">' + esc(c.abstract) + '</p>' : '') +
    '<p>If anything is wrong, or you can no longer attend, just reply to this email.</p>' +
    '<p>The organizing committee<br><a href="' + esc(SITE_URL) + '" style="color:#4A2C86">' + esc(SITE_URL) + '</a></p>' +
    '</div>';

  MailApp.sendEmail({
    to: c.email,
    subject: subject,
    body: plain,
    htmlBody: html,
    name: EVENT_NAME,
    replyTo: /@/.test(CONTACT_EMAIL) ? CONTACT_EMAIL : undefined,
  });
}

/**
 * Run this once from the editor (select testEmail, then Run) to grant the
 * permission to send emails, or to check that sending works.
 * The test email goes to your own address.
 */
function testEmail() {
  const me = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(me, 'Test: ' + EVENT_NAME + ' registration emails', 'Sending works. Remaining quota today: ' + MailApp.getRemainingDailyQuota());
  console.log('Test email sent to ' + me);
}
