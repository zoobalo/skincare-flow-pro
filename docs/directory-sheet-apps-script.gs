/**
 * Zoobalo — Digital Directory sheet bridge.
 *
 * Paste into the Digital Directory spreadsheet (Extensions -> Apps Script),
 * then Deploy > New deployment > Web app:
 *   Execute as:     Me
 *   Who has access: Anyone
 *
 * Send the /exec URL back and the directory can be written straight in, and
 * refreshed any time the data changes.
 */
function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    if (req.action !== 'write') return json({ error: 'Unknown action: ' + req.action });

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var headers = req.headers || [];
    var rows = req.rows || [];

    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
    if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);

    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, Math.min(headers.length, 12));
    if (rows.length) sh.getRange(1, 1, rows.length + 1, headers.length).createFilter();

    return json({ ok: true, rows: rows.length, columns: headers.length });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json({ ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
