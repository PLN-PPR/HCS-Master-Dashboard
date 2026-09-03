/**
 * HCS Master Dashboard - Google Apps Script data endpoint
 * Spreadsheet master:
 * https://docs.google.com/spreadsheets/d/1DovJeu71JnS56iN31jMTrVLl5I6K2G3RDNPFLGS7JA4/
 *
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1DovJeu71JnS56iN31jMTrVLl5I6K2G3RDNPFLGS7JA4',
  DEFAULT_CALLBACK: 'hcsData',
  TIMEZONE: 'Asia/Jakarta'
});

/**
 * Web App endpoint.
 *
 * JSON:
 *   /exec?format=json
 *
 * JSONP (for GitHub Pages):
 *   /exec?callback=hcsData
 */
function doGet(e) {
  try {
    const parameters = e && e.parameter ? e.parameter : {};
    const result = readAllSheets_();

    if (String(parameters.format || '').toLowerCase() === 'json') {
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const callback = sanitizeCallback_(
      parameters.callback || CONFIG.DEFAULT_CALLBACK
    );

    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (error) {
    return createErrorResponse_(e, error);
  }
}

/** Reads every tab in the spreadsheet. */
function readAllSheets_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();
  const output = {
    _meta: {
      success: true,
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      spreadsheetName: spreadsheet.getName(),
      updatedAt: Utilities.formatDate(
        new Date(),
        CONFIG.TIMEZONE,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      ),
      totalSheets: sheets.length,
      sheetNames: sheets.map(function (sheet) {
        return sheet.getName();
      })
    },
    sheets: {}
  };

  sheets.forEach(function (sheet) {
    output.sheets[sheet.getName()] = readSheet_(sheet);
  });

  return output;
}

/** Reads one tab, treating its first row as column headers. */
function readSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    return {
      name: sheet.getName(),
      rowCount: 0,
      columnCount: 0,
      headers: [],
      rows: []
    };
  }

  const range = sheet.getRange(1, 1, lastRow, lastColumn);
  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();

  const headers = displayValues[0].map(function (header, index) {
    const cleanedHeader = String(header || '').trim();
    return cleanedHeader || 'kolom_' + (index + 1);
  });

  const rows = [];

  for (let rowIndex = 1; rowIndex < rawValues.length; rowIndex++) {
    const rawRow = rawValues[rowIndex];
    const displayRow = displayValues[rowIndex];
    const isEmpty = rawRow.every(function (value) {
      return value === '' || value === null;
    });

    if (isEmpty) continue;

    const record = {};
    headers.forEach(function (header, columnIndex) {
      record[header] = normalizeValue_(
        rawRow[columnIndex],
        displayRow[columnIndex]
      );
    });
    rows.push(record);
  }

  return {
    name: sheet.getName(),
    rowCount: rows.length,
    columnCount: headers.length,
    headers: headers,
    rows: rows
  };
}

/** Keeps numbers as numbers and serializes dates consistently. */
function normalizeValue_(rawValue, displayValue) {
  if (rawValue === '' || rawValue === null) return '';

  if (rawValue instanceof Date) {
    return Utilities.formatDate(
      rawValue,
      CONFIG.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss'
    );
  }

  if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'string') return rawValue.trim();
  return String(displayValue || rawValue).trim();
}

/** Allows only a valid JSONP function name. */
function sanitizeCallback_(callback) {
  const cleaned = String(callback || '').replace(/[^a-zA-Z0-9_.$]/g, '');
  return cleaned || CONFIG.DEFAULT_CALLBACK;
}

/** Returns errors in the same JSON or JSONP format as successful responses. */
function createErrorResponse_(e, error) {
  const parameters = e && e.parameter ? e.parameter : {};
  const response = {
    _meta: {
      success: false,
      updatedAt: Utilities.formatDate(
        new Date(),
        CONFIG.TIMEZONE,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      ),
      message: error && error.message ? error.message : String(error)
    },
    sheets: {}
  };

  if (String(parameters.format || '').toLowerCase() === 'json') {
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const callback = sanitizeCallback_(
    parameters.callback || CONFIG.DEFAULT_CALLBACK
  );

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(response) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** Run once in the editor to grant access and verify all tabs. */
function testReadSpreadsheet() {
  const result = readAllSheets_();

  Logger.log('Spreadsheet: ' + result._meta.spreadsheetName);
  Logger.log('Jumlah tab: ' + result._meta.totalSheets);
  Logger.log('Nama tab: ' + result._meta.sheetNames.join(', '));

  Object.keys(result.sheets).forEach(function (sheetName) {
    Logger.log(
      sheetName + ': ' + result.sheets[sheetName].rowCount + ' baris'
    );
  });

  return result;
}
