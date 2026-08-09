/**
 * BARAKA EDU — ПРИЁМ ЗАЯВОК
 *
 * ОДНА таблица, ДВА листа, ОДИН скрипт, ОДИН doPost.
 * (В проекте Apps Script doPost может быть только один — поэтому вход общий,
 *  а заявки разводятся по листам ПО ПРЕФИКСУ ИМЁН ПОЛЕЙ.)
 *
 *   webinar_*  →  лист "Webinar page"   (страница с переходом в Telegram)
 *                 Дата | Время | Имя | Телефон | Договор | Источник
 *
 *   lead_*     →  лист "Selling page"   (продающая страница с тарифами)
 *                 Дата | Время | Имя | Телефон | Договор | Тариф
 *
 * Листы и шапки создаются сами при первой заявке — заранее ничего делать не нужно.
 *
 * УСТАНОВКА:
 * 1. Одна Google Таблица → Extensions → Apps Script.
 * 2. Удали код-заглушку, вставь этот файл, сохрани.
 * 3. Deploy → New deployment → Web app:
 *       Execute as:      Me
 *       Who has access:  Anyone      ← обязательно, иначе заявки не дойдут
 * 4. Открой полученный /exec в браузере — должно ответить {"result":"ok"}.
 *
 * ПОСЛЕ ЛЮБОЙ ПРАВКИ КОДА:
 * Deploy → Manage deployments → Edit (карандаш) → Version: New version → Deploy.
 * Без этого на боевом URL остаётся старая версия.
 *
 * ДОБАВИТЬ ТРЕТЬЮ СТРАНИЦУ: допиши блок в FORMS ниже — остальной код не трогается.
 */

/* ============================================================
   КОНФИГ ФОРМ
   ============================================================ */
var FORMS = [
  {
    prefix: 'webinar_',
    sheet:  'Webinar page',
    last:   'Источник',              // чем заполняется 6-я колонка
    lastKey: 'source',
    lastDefault: 'Webinar page'
  },
  {
    prefix: 'lead_',
    sheet:  'Selling page',
    last:   'Тариф',
    lastKey: 'tariff',
    lastDefault: ''
  }
];

var BASE_HEADERS = ['Дата', 'Время', 'Имя', 'Телефон', 'Договор'];
var PHONE_COL = 4;   // столбец D — по нему ищем дубли


/* ============================================================
   ВХОД
   ============================================================ */
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

    // ---- РАЗВЕТВЛЕНИЕ ПО ПРЕФИКСУ ПОЛЕЙ ----
    var form = detectForm(data);
    if (!form) {
      releaseLock(lock);
      return out({ result: 'rejected', reason: 'unknown_form' });
    }

    var res = saveLead(form, data);
    releaseLock(lock);
    return out(res);

  } catch (err) {
    releaseLock(lock);
    return out({ result: 'error', message: err.toString() });
  }
}

/* Проверка деплоя прямо из браузера */
function doGet() {
  return out({ result: 'ok', time: new Date().toISOString() });
}

/* Какая форма прислала заявку: ищем поля с известным префиксом */
function detectForm(data) {
  for (var i = 0; i < FORMS.length; i++) {
    var p = FORMS[i].prefix;
    if (data[p + 'name'] !== undefined || data[p + 'phone'] !== undefined) {
      return FORMS[i];
    }
  }
  return null;
}


/* ============================================================
   ЗАПИСЬ ЗАЯВКИ
   ============================================================ */
function saveLead(form, data) {
  var p = form.prefix;

  var name      = (data[p + 'name'] || '').toString().trim();
  var phoneRaw  = (data[p + 'phone'] || '').toString().trim();
  var agreement = (data[p + 'agreement'] || 'Принял').toString().trim();

  // 6-я колонка: Источник для вебинара, Тариф для продающей
  var lastVal = (data[p + form.lastKey] || form.lastDefault).toString().trim();

  // Телефон: только цифры, последние 9 → 901234567
  var phone = phoneRaw.replace(/\D/g, '');
  if (phone.length > 9) phone = phone.slice(-9);

  if (!name || phone.length < 9) {
    return { result: 'rejected', reason: 'missing_fields' };
  }

  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var timeStr = Utilities.formatDate(now, tz, 'HH:mm:ss');

  var sheet = getSheet(form);

  // Дедупликация по последним 6 цифрам номера
  var dupRow = findDuplicateRow(sheet, phone);

  if (dupRow > 0) {
    sheet.getRange(dupRow, 1).setValue(dateStr);    // A Дата
    sheet.getRange(dupRow, 2).setValue(timeStr);    // B Время
    sheet.getRange(dupRow, 3).setValue(name);       // C Имя
    sheet.getRange(dupRow, 5).setValue(agreement);  // E Договор
    if (lastVal) sheet.getRange(dupRow, 6).setValue(lastVal);  // F Источник/Тариф
    return { result: 'success', status: 'DUPLICATE', sheet: form.sheet, row: dupRow };
  }

  sheet.appendRow([
    dateStr,        // A Дата
    timeStr,        // B Время
    name,           // C Имя
    "'" + phone,    // D Телефон (апостроф — чтобы не потерять ведущий ноль)
    agreement,      // E Договор
    lastVal         // F Источник / Тариф
  ]);

  return { result: 'success', status: 'NEW', sheet: form.sheet, row: sheet.getLastRow() };
}


/* ============================================================
   ЛИСТЫ
   ============================================================ */
function getSheet(form) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(form.sheet);

  // Только по имени. getActiveSheet() тут использовать нельзя:
  // insertSheet() делает новый лист активным, и заявки уехали бы не туда.
  if (!sh) sh = ss.insertSheet(form.sheet);

  if (sh.getLastRow() === 0) {
    var headers = BASE_HEADERS.concat([form.last]);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#DCEEE2');
    sh.setFrozenRows(1);
    sh.setColumnWidth(3, 180);  // Имя
    sh.setColumnWidth(4, 130);  // Телефон
  }
  return sh;
}

/* Поиск дубля по последним 6 цифрам, начиная со 2-й строки (шапку не трогаем) */
function findDuplicateRow(sheet, phone) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var tail = phone.slice(-6);
  var vals = sheet.getRange(2, PHONE_COL, lastRow - 1, 1).getValues();

  for (var i = 0; i < vals.length; i++) {
    var existing = vals[i][0].toString().replace(/\D/g, '');
    if (existing.length >= 6 && existing.slice(-6) === tail) {
      return i + 2;   // +2: пропущенная шапка и переход к 1-based
    }
  }
  return -1;
}


/* ============================================================
   УТИЛИТЫ
   ============================================================ */
function releaseLock(lock) {
  if (!lock) return;
  try { lock.releaseLock(); } catch (x) {}
}

function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
