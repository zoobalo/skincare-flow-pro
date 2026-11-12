/**
 * Zoobalo — Receivings backup sheet bridge.
 *
 * Paste this into the receivings backup spreadsheet
 * (Extensions -> Apps Script), then deploy it as a web app:
 *
 *   Deploy > New deployment > Web app
 *     Execute as:      Me
 *     Who has access:  Anyone
 *
 * Copy the /exec URL and set it on the server as
 *   RECEIVINGS_SHEET_SCRIPT_URL
 *
 * The script only ever appends. It never edits or deletes a row that is
 * already there, so anything written by hand in the sheet survives.
 *
 * Rows are identified by the "Record ID" in the last column. Zoobalo sends
 * every receipt each time; this script appends only the ids it has not seen
 * before, so exporting twice adds nothing twice.
 */

// The tab to write to, taken from the gid in the spreadsheet's URL.
// Set to null to use the first tab instead.
var TARGET_GID = 716805124;

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    if (req.action === 'append') return json(appendRows(req));
    if (req.action === 'ping')   return json({ ok: true, rows: targetSheet().getLastRow() });
    return json({ error: 'Unknown action: ' + req.action });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

/** Lets you open the /exec URL in a browser to check the deployment. */
function doGet() {
  try {
    var sheet = targetSheet();
    return json({ ok: true, tab: sheet.getName(), rows: Math.max(0, sheet.getLastRow() - 1) });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

function targetSheet() {
  var ss = SpreadsheetApp.getActive();
  if (TARGET_GID !== null) {
    var all = ss.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getSheetId() === TARGET_GID) return all[i];
    }
    throw new Error('No tab with gid ' + TARGET_GID + ' in this spreadsheet. ' +
                    'Set TARGET_GID at the top of the script, or null for the first tab.');
  }
  return ss.getSheets()[0];
}

function appendRows(req) {
  var header = req.header || [];
  var rows = req.rows || [];
  var sheet = targetSheet();

  // Write the header once, on a sheet that has never been used.
  if (sheet.getLastRow() === 0 && header.length) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var idColumn = header.length;           // "Record ID" is the last column
  var seen = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1 && idColumn > 0) {
    var ids = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i][0] || '').trim();
      if (id) seen[id] = true;
    }
  }

  var fresh = [];
  for (var j = 0; j < rows.length; j++) {
    var id = String(rows[j][idColumn - 1] || '').trim();
    if (id && seen[id]) continue;
    if (id) seen[id] = true;              // guards duplicates inside one batch
    fresh.push(rows[j]);
  }

  if (fresh.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, header.length).setValues(fresh);
  }

  return {
    appended: fresh.length,
    skipped: rows.length - fresh.length,
    total: Math.max(0, sheet.getLastRow() - 1)
  };
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
