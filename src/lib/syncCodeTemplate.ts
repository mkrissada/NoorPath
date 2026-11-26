// Matches NoorPath/apps-script/Code.gs for 1-click copy from Settings
export const APPS_SCRIPT_CODE = `/**
 * NoorPath Google Sheets Sync Web App (Apps Script)
 *
 * วิธีตั้งค่า:
 * 1. สร้าง Google Sheet ใหม่ -> เมนู ส่วนขยาย (Extensions) -> Apps Script
 * 2. วางโค้ดนี้ทั้งหมดแทนที่ไฟล์ Code.gs เดิม
 * 3. ตั้งค่ารหัสลับอย่างใดอย่างหนึ่ง:
 *    - Project Settings -> Script Properties -> เพิ่ม NOORPATH_TOKEN = รหัสลับของคุณ (แนะนำ)
 *    - หรือใส่ใน FALLBACK_TOKEN ด้านล่าง (หากไม่ใช้ Script Properties)
 * 4. กด Deploy -> New deployment -> Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. คัดลอก Web app URL และ Token ไปกรอกในหน้า "ตั้งค่า" ของ NoorPath บนทุกอุปกรณ์
 */

const FALLBACK_TOKEN = '';
const RECORDS_SHEET = 'records';
const SUMMARY_SHEET = 'สรุปภาพรวม';

function getExpectedToken_() {
  const prop = PropertiesService.getScriptProperties().getProperty('NOORPATH_TOKEN');
  return (prop || FALLBACK_TOKEN || '').trim();
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let recSheet = ss.getSheetByName(RECORDS_SHEET);
  if (!recSheet) {
    recSheet = ss.insertSheet(RECORDS_SHEET);
    recSheet.appendRow(['key', 'type', 'value', 'updatedAt', 'deviceId', 'deleted']);
    recSheet.setFrozenRows(1);
    recSheet.getRange('A1:F1').setFontWeight('bold');
  }

  let sumSheet = ss.getSheetByName(SUMMARY_SHEET);
  if (!sumSheet) {
    sumSheet = ss.insertSheet(SUMMARY_SHEET, 0);
    sumSheet.getRange('A1:B1').setValues([['หัวข้อสถิติ NoorPath (ซิงก์ล่าสุด)', 'จำนวน / ค่า']]);
    sumSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#0F6B53').setFontColor('#FFFFFF');

    const rows = [
      ['อายะฮ์ที่อ่านแล้ว (ทั้งหมดที่บันทึก)', '=COUNTIFS(records!B:B,"read",records!F:F,FALSE)'],
      ['อายะฮ์ที่จำแม่นแล้ว (รวมอัลกุรอาน/ฮะดีษ)', '=COUNTIFS(records!B:B,"hifz",records!F:F,FALSE,records!C:C,"*""memorized""*")'],
      ['อายะฮ์/บทที่กำลังท่อง', '=COUNTIFS(records!B:B,"hifz",records!F:F,FALSE,records!C:C,"*""learning""*")'],
      ['อายะฮ์/บทที่ต้องทบทวน', '=COUNTIFS(records!B:B,"hifz",records!F:F,FALSE,records!C:C,"*""review""*")'],
      ['ฮะดีษที่อ่านแล้ว', '=COUNTIFS(records!B:B,"readHadith",records!F:F,FALSE)'],
      ['บุ๊กมาร์ก', '=COUNTIFS(records!B:B,"bookmark",records!F:F,FALSE)'],
      ['จำนวนรายการซิงก์ทั้งหมด', '=MAX(0,COUNTA(records!A:A)-1)'],
      ['อุปกรณ์ที่ซิงก์ล่าสุด', '-'],
      ['เวลาซิงก์ล่าสุด', '-'],
    ];
    sumSheet.getRange(2, 1, rows.length, 2).setValues(rows);
    sumSheet.setColumnWidth(1, 320);
    sumSheet.setColumnWidth(2, 200);
  }

  return { recSheet, sumSheet };
}

function readAllRecords_(recSheet) {
  const lastRow = recSheet.getLastRow();
  if (lastRow < 2) return [];
  const values = recSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const key = String(row[0] || '');
    if (!key) continue;
    let parsedVal = null;
    try {
      parsedVal = row[2] ? JSON.parse(String(row[2])) : null;
    } catch (e) {
      parsedVal = row[2];
    }
    out.push({
      key: key,
      type: String(row[1] || 'singleton'),
      value: parsedVal,
      updatedAt: Number(row[3] || 0),
      deviceId: String(row[4] || ''),
      deleted: row[5] === true || String(row[5]).toUpperCase() === 'TRUE',
    });
  }
  return out;
}

function doGet(e) {
  try {
    const expected = getExpectedToken_();
    if (!expected) {
      return jsonOut_({ ok: false, error: 'NOORPATH_TOKEN is not configured in Apps Script' });
    }
    const params = (e && e.parameter) || {};
    if (String(params.token || '').trim() !== expected) {
      return jsonOut_({ ok: false, error: 'unauthorized' });
    }
    const action = String(params.action || 'pull');
    const { recSheet } = ensureSheets_();
    const now = Date.now();
    if (action === 'ping') {
      return jsonOut_({ ok: true, serverTime: now, totalRecords: Math.max(0, recSheet.getLastRow() - 1) });
    }
    const since = Number(params.since || 0);
    const records = readAllRecords_(recSheet).filter(function (r) {
      return r.updatedAt > since;
    });
    return jsonOut_({ ok: true, serverTime: now, records: records });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const expected = getExpectedToken_();
    if (!expected) {
      return jsonOut_({ ok: false, error: 'NOORPATH_TOKEN is not configured in Apps Script' });
    }
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const body = JSON.parse(raw);
    if (String(body.token || '').trim() !== expected) {
      return jsonOut_({ ok: false, error: 'unauthorized' });
    }

    const { recSheet, sumSheet } = ensureSheets_();
    const incoming = Array.isArray(body.records) ? body.records : [];
    const deviceLabel = String(body.deviceName || body.deviceId || 'unknown');
    const since = Number(body.since || 0);
    const returnPull = body.pull === true;

    const lastRow = recSheet.getLastRow();
    const existingValues = lastRow >= 2 ? recSheet.getRange(2, 1, lastRow - 1, 6).getValues() : [];
    const rowIndexByKey = {};
    for (let i = 0; i < existingValues.length; i++) {
      const k = String(existingValues[i][0] || '');
      if (k) rowIndexByKey[k] = i;
    }

    let applied = 0;
    const toAppend = [];
    for (let i = 0; i < incoming.length; i++) {
      const rec = incoming[i];
      if (!rec || !rec.key) continue;
      const key = String(rec.key);
      const updatedAt = Number(rec.updatedAt || 0);
      const rowData = [
        key,
        String(rec.type || 'singleton'),
        JSON.stringify(rec.value !== undefined ? rec.value : null),
        updatedAt,
        String(rec.deviceId || body.deviceId || ''),
        Boolean(rec.deleted),
      ];

      if (Object.prototype.hasOwnProperty.call(rowIndexByKey, key)) {
        const idx = rowIndexByKey[key];
        const prevUpdatedAt = Number(existingValues[idx][3] || 0);
        if (updatedAt >= prevUpdatedAt) {
          existingValues[idx] = rowData;
          applied++;
        }
      } else {
        rowIndexByKey[key] = existingValues.length + toAppend.length;
        toAppend.push(rowData);
        applied++;
      }
    }

    if (existingValues.length > 0 && applied > 0) {
      recSheet.getRange(2, 1, existingValues.length, 6).setValues(existingValues);
    }
    if (toAppend.length > 0) {
      recSheet.getRange(2 + existingValues.length, 1, toAppend.length, 6).setValues(toAppend);
    }

    const now = Date.now();
    sumSheet.getRange('B9:B10').setValues([
      [deviceLabel],
      [Utilities.formatDate(new Date(now), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss')],
    ]);

    const response = { ok: true, serverTime: now, applied: applied };
    if (returnPull) {
      const all = existingValues.concat(toAppend).map(function (row) {
        let parsedVal = null;
        try {
          parsedVal = row[2] ? JSON.parse(String(row[2])) : null;
        } catch (err) {
          parsedVal = row[2];
        }
        return {
          key: String(row[0] || ''),
          type: String(row[1] || 'singleton'),
          value: parsedVal,
          updatedAt: Number(row[3] || 0),
          deviceId: String(row[4] || ''),
          deleted: row[5] === true || String(row[5]).toUpperCase() === 'TRUE',
        };
      });
      response.records = all.filter(function (r) {
        return r.updatedAt > since;
      });
    }
    return jsonOut_(response);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
`;
