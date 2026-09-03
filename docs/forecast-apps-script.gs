/**
 * Zoobalo — Inventory Forecast sheet bridge.
 *
 * Paste this into BOTH the weekly-sales and the stock spreadsheet
 * (Extensions -> Apps Script), then deploy each as its own web app:
 *
 *   Deploy > New deployment > Web app
 *     Execute as:      Me
 *     Who has access:  Anyone
 *
 * Copy each /exec URL and give it to Zoobalo:
 *   sales sheet -> SALES_SHEET_SCRIPT_URL
 *   stock sheet -> STOCK_SHEET_SCRIPT_URL
 *
 * The script only ever touches the first sheet tab, plus dated archive tabs
 * it creates itself.
 */

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    if (req.action === 'template') return json(writeTemplate(req));
    if (req.action === 'pull')     return json({ values: readGrid() });
    return json({ error: 'Unknown action: ' + req.action });
  } catch (err) {
    return json({ error: String(err && err.message ? err.message : err) });
  }
}

// Allows a browser sanity-check of the deployment.
function doGet() {
  return json({ ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
}

function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

/**
 * Lays out the grid Zoobalo dictates: a title row, a header row, then one row
 * per SKU with its code and name filled in. Numbers already typed for the same
 * SKUs are preserved, so re-syncing mid-week does not wipe the entry work.
 */
function writeTemplate(req) {
  var sh = sheet_();
  var headers = req.headers || [];
  var rows = req.rows || [];

  var prevTitle = String(sh.getRange(1, 1).getValue() || '').trim();
  var newTitle = String(req.title || '').trim();
  // Numbers carry over only within the same period. A new week starts blank,
  // so nobody submits last week's figures by mistake.
  var samePeriod = prevTitle !== '' && prevTitle === newTitle;

  var existing = {};
  var last = sh.getLastRow();
  if (last >= 3) {
    var oldHeader = sh.getRange(2, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var old = sh.getRange(3, 1, last - 2, Math.max(sh.getLastColumn(), 1)).getValues();
    archive_(sh, oldHeader, old, prevTitle);   // snapshot before we clear
    if (samePeriod) {
      for (var i = 0; i < old.length; i++) {
        var code = String(old[i][0] || '').trim();
        if (code) existing[code] = old[i];
      }
    }
  }

  sh.clear();
  sh.getRange(1, 1).setValue(req.title || '').setFontWeight('bold');
  sh.getRange(2, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#f1f3f4');

  if (rows.length) {
    var out = rows.map(function (r) {
      var prev = existing[String(r[0]).trim()];
      if (!prev) return r;
      // keep previously entered numbers, column by column
      return r.map(function (cell, idx) {
        return idx < 2 ? cell : (prev[idx] !== undefined && prev[idx] !== '' ? prev[idx] : '');
      });
    });
    sh.getRange(3, 1, out.length, headers.length).setValues(out);
  }

  sh.setFrozenRows(2);
  sh.setFrozenColumns(2);
  sh.getRange(1, 1, 2 + rows.length, 2).setBackground('#fafafa');
  sh.autoResizeColumns(1, 2);
  return { rows: rows.length, columns: headers.length };
}

/**
 * Returns [headerRow, ...dataRows]. Deliberately does no writing — reading is
 * on the critical path of the IN button, and creating an archive tab here made
 * the call take up to a minute and time out.
 */
function readGrid() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var cols = sh.getLastColumn();
  if (last < 3) return [];
  return [sh.getRange(2, 1, 1, cols).getValues()[0]]
    .concat(sh.getRange(3, 1, last - 2, cols).getValues());
}

/**
 * Snapshot taken just before the grid is overwritten, so a week's entry is
 * never lost if the template is re-synced before anyone pressed IN.
 */
function archive_(sh, header, data, title) {
  try {
    if (!data || !data.length) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var clean = String(title || '').replace(/[^\w\s-]/g, '').trim();
    var name = ('Archive ' + clean).substring(0, 90) || 'Archive';
    var old = ss.getSheetByName(name);
    if (old) ss.deleteSheet(old);
    var tab = ss.insertSheet(name, ss.getNumSheets());
    tab.getRange(1, 1, 1, header.length).setValues([header]);
    if (data.length) tab.getRange(2, 1, data.length, header.length).setValues(data);
    tab.hideSheet();
  } catch (err) {
    // Archiving must never block an import.
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
