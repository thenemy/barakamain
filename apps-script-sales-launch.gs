/**
 * BARAKA EDU — SELLING PAGE
 * Приём заявок с продающей страницы в Google Таблицу.
 *
 * Колонки: A Дата | B Время | C Имя | D Телефон | E Договор | F Источник
 * Шапка создаётся автоматически при первой заявке.
 *
 * УСТАНОВКА:
 * 1. Новая Google Таблица → Extensions → Apps Script.
 * 2. Удали код-заглушку, вставь этот файл, сохрани.
 * 3. Deploy → New deployment → Web app:
 *       Execute as:      Me
 *       Who has access:  Anyone     ← обязательно, иначе заявки не дойдут
 * 4. Открой полученный /exec URL в браузере — должно ответить {"result":"ok"}.
 *
 * ВАЖНО: после правок кода — Deploy → Manage deployments → Edit (карандаш)
 * → Version: New version → Deploy. Иначе на боевом URL останется старый код.
 */

var SHEET_NAME = 'Selling page';
var HEADERS = ['Дата', 'Время', 'Имя', 'Телефон', 'Договор', 'Источник'];

function doPost(e) {
  // Блокировка: при наплыве заявки пишутся по очереди и не путают строки.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    // не смогли взять блокировку — всё равно пробуем записать
  }

  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    var data = {};
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      data = {};
    }

    var name      = (data.name || '').toString().trim();
    var phoneRaw  = (data.phone || '').toString().trim();
    var agreement = (data.agreement || 'Принял').toString().trim();
    var source    = (data.source || 'Selling page').toString().trim();

    // Телефон: только цифры, последние 9 (901234567)
    var phone = phoneRaw.replace(/\D/g, '');
    if (phone.length > 9) phone = phone.slice(-9);

    // Валидация
    if (!name || phone.length < 9) {
      releaseLock(lock);
      return out({ result: 'rejected', reason: 'missing_fields' });
    }

    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    var timeStr = Utilities.formatDate(now, tz, 'HH:mm:ss');

    var sheet = getSheet();

    // Дедупликация по последним 6 цифрам номера (столбец D)
    var duplicateRow = findDuplicateRow(sheet, phone);

    if (duplicateRow > 0) {
      // Повторная заявка — обновляем, чтобы не плодить строки
      sheet.getRange(duplicateRow, 1).setValue(dateStr);    // A Дата
      sheet.getRange(duplicateRow, 2).setValue(timeStr);    // B Время
      sheet.getRange(duplicateRow, 3).setValue(name);       // C Имя
      sheet.getRange(duplicateRow, 5).setValue(agreement);  // E Договор
      sheet.getRange(duplicateRow, 6).setValue(source);     // F Источник

      releaseLock(lock);
      return out({ result: 'success', status: 'DUPLICATE', row: duplicateRow });
    }

    sheet.appendRow([
      dateStr,        // A Дата
      timeStr,        // B Время
      name,           // C Имя
      "'" + phone,    // D Телефон (апостроф — чтобы не съело ведущий ноль)
      agreement,      // E Договор
      source          // F Источник
    ]);

    releaseLock(lock);
    return out({ result: 'success', status: 'NEW', row: sheet.getLastRow() });

  } catch (err) {
    releaseLock(lock);
    return out({ result: 'error', message: err.toString() });
  }
}

/* Проверка деплоя прямо из браузера */
function doGet() {
  return out({ result: 'ok', sheet: SHEET_NAME, time: new Date().toISOString() });
}

/* ---------- Лист: берём существующий или создаём с шапкой ---------- */
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#DCEEE2');
    sh.setFrozenRows(1);
    sh.setColumnWidth(3, 180);  // Имя
    sh.setColumnWidth(4, 130);  // Телефон
  }
  return sh;
}

/* ---------- Поиск дубля по последним 6 цифрам ---------- */
function findDuplicateRow(sheet, phone) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var tail = phone.slice(-6);
  var values = sheet.getRange(2, 4, lastRow - 1, 1).getValues(); // столбец D, без шапки

  for (var i = 0; i < values.length; i++) {
    var existing = values[i][0].toString().replace(/\D/g, '');
    if (existing.length >= 6 && existing.slice(-6) === tail) {
      return i + 2; // +2: пропущенная шапка и переход к 1-based
    }
  }
  return -1;
}

/* ---------- Утилиты ---------- */
function releaseLock(lock) {
  if (!lock) return;
  try { lock.releaseLock(); } catch (x) {}
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
