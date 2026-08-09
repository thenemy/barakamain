/**
 * BARAKA EDU — ОБЪЕДИНЁННЫЙ ПРИЁМНИК ЗАЯВОК
 *
 * В одном проекте Apps Script может быть только один doPost(). Поэтому здесь
 * один вход, который РАЗВОДИТ заявки по листам в зависимости от поля "form":
 *
 *   form: "selling"  → лист "Selling page"  (Дата | Время | Имя | Телефон | Договор | Источник)
 *   всё остальное    → старая логика: "All leads" + "Website tarif"
 *
 * ПОЧЕМУ ЭТО БЕЗОПАСНО ДЛЯ ДЕЙСТВУЮЩЕГО САЙТА:
 * старая страница поля "form" не отправляет вообще. Значит условие никогда
 * не сработает, и её заявки идут по прежнему пути, байт в байт как раньше.
 * Новая продающая страница будет слать form:"selling" явно.
 *
 * ОБНОВЛЕНИЕ:
 * 1. Замени содержимое скрипта на этот файл.
 * 2. Deploy → Manage deployments → Edit (карандаш) → Version: New version → Deploy.
 *    БЕЗ этого шага на боевом URL останется старый код.
 * 3. URL (/exec) не меняется — старая страница продолжает работать.
 */

/* ============================================================
   ВХОД
   ============================================================ */
function doPost(e) {
  // Блокировка: при наплыве запросы выполняются по очереди, не путая строки.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // ждём до 20 сек своей очереди
  } catch (lockErr) {
    // не смогли взять блокировку — всё равно попробуем записать
  }

  var raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
  var data = {};
  try {
    data = JSON.parse(raw);
  } catch (parseErr) {
    data = {};
  }

  // ---- РАЗВЕТВЛЕНИЕ ----
  var form = (data.form || "").toString().trim().toLowerCase();
  if (form === "selling") {
    return handleSellingPage(data, lock);
  }

  return handleTariffSite(data, lock);
}

/* Проверка деплоя прямо из браузера */
function doGet() {
  return out({ result: "ok", time: new Date().toISOString() });
}


/* ============================================================
   НОВОЕ: ПРОДАЮЩАЯ СТРАНИЦА → лист "Selling page"
   Колонки: A Дата | B Время | C Имя | D Телефон | E Договор | F Источник
   ============================================================ */
var SELLING_SHEET  = "Selling page";
var SELLING_HEADERS = ["Дата", "Время", "Имя", "Телефон", "Договор", "Источник"];

function handleSellingPage(data, lock) {
  try {
    var name      = (data.name || "").toString().trim();
    var phoneRaw  = (data.phone || "").toString().trim();
    var agreement = (data.agreement || "Принял").toString().trim();
    var source    = (data.source || "Selling page").toString().trim();

    var phone = phoneRaw.replace(/\D/g, "");
    if (phone.length > 9) phone = phone.slice(-9);

    if (!name || phone.length < 9) {
      releaseLock(lock);
      return out({ result: "rejected", reason: "missing_fields" });
    }

    var now = new Date();
    var tz = Session.getScriptTimeZone();
    var dateStr = Utilities.formatDate(now, tz, "yyyy-MM-dd");
    var timeStr = Utilities.formatDate(now, tz, "HH:mm:ss");

    var sheet = getSellingSheet();

    // Дедупликация по последним 6 цифрам (столбец D), начиная со 2-й строки
    var dupRow = -1;
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var tail = phone.slice(-6);
      var vals = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
      for (var i = 0; i < vals.length; i++) {
        var existing = vals[i][0].toString().replace(/\D/g, "");
        if (existing.length >= 6 && existing.slice(-6) === tail) {
          dupRow = i + 2;
          break;
        }
      }
    }

    if (dupRow > 0) {
      sheet.getRange(dupRow, 1).setValue(dateStr);    // A Дата
      sheet.getRange(dupRow, 2).setValue(timeStr);    // B Время
      sheet.getRange(dupRow, 3).setValue(name);       // C Имя
      sheet.getRange(dupRow, 5).setValue(agreement);  // E Договор
      sheet.getRange(dupRow, 6).setValue(source);     // F Источник

      releaseLock(lock);
      return out({ result: "success", status: "DUPLICATE", row: dupRow });
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
    return out({ result: "success", status: "NEW", row: sheet.getLastRow() });

  } catch (err) {
    releaseLock(lock);
    return out({ result: "error", message: err.toString() });
  }
}

function getSellingSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SELLING_SHEET);
  if (!sh) sh = ss.insertSheet(SELLING_SHEET);

  if (sh.getLastRow() === 0) {
    sh.appendRow(SELLING_HEADERS);
    sh.getRange(1, 1, 1, SELLING_HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#DCEEE2");
    sh.setFrozenRows(1);
    sh.setColumnWidth(3, 180);
    sh.setColumnWidth(4, 130);
  }
  return sh;
}


/* ============================================================
   СТАРОЕ: ТАРИФНЫЙ САЙТ → "All leads" + "Website tarif"
   Логика без изменений — только вынесена в отдельную функцию.
   ============================================================ */
function handleTariffSite(data, lock) {
  var backupResult = "";      // что произошло с основным листом
  var backupRowIndex = -1;    // строка в All leads, чтобы потом дописать результат

  try {
    var name = (data.name || "").toString().trim();
    var phoneRaw = (data.phone || "").toString().trim(); // как пришло (Телефон 1)
    var tariff = (data.tariff || "").toString().trim();
    var source = (data.source || "Сайт Тариф").toString().trim();
    var agreement = (data.agreement || "Принял").toString().trim();

    // Обработанный телефон: только цифры, последние 9 (Телефон 2)
    var phone = phoneRaw.replace(/\D/g, "");
    if (phone.length > 9) {
      phone = phone.slice(-9);
    }

    // Валидация
    if (!name || phone.length < 9) {
      releaseLock(lock);
      return out({ result: "rejected", reason: "missing_fields" });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Дата и время
    var now = new Date();
    var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss");

    // ============================================================
    // ШАГ 1: СТРАХОВКА — пишем сырой лид в "All leads" СРАЗУ, без проверок.
    // ============================================================
    try {
      var backup = ss.getSheetByName("All leads");
      if (!backup) {
        backup = ss.insertSheet("All leads");
      }

      var bRow = [];
      bRow[0]  = dateStr;              // A — Дата
      bRow[1]  = timeStr;              // B — Время
      bRow[2]  = name;                 // C — Имя
      bRow[3]  = "'" + phoneRaw;       // D — Телефон 1 (сырой, как текст)
      bRow[4]  = "";                   // E
      bRow[5]  = "";                   // F
      bRow[6]  = source;               // G — Источник
      bRow[7]  = "'" + phone;          // H — Телефон 2 (9 цифр, как текст)
      bRow[8]  = "PENDING";            // I — Результат (обновим ниже)
      bRow[9]  = "";                   // J
      bRow[10] = "";                   // K
      bRow[11] = tariff;               // L — Тариф

      backup.appendRow(bRow);
      backupRowIndex = backup.getLastRow();
    } catch (backupErr) {
      backupResult = "BACKUP_ERR: " + backupErr.toString();
    }

    // ============================================================
    // ШАГ 2: ОСНОВНОЙ ЛИСТ "Website tarif" с дедупликацией
    // ============================================================
    try {
      var sheet = ss.getSheetByName("Website tarif");
      if (!sheet) sheet = ss.getActiveSheet();

      var last6Digits = phone.slice(-6);
      var lastRow = sheet.getLastRow();
      var duplicateFound = false;
      var duplicateRowIndex = -1;

      if (lastRow >= 2) {
        var phoneValues = sheet.getRange(1, 4, lastRow, 1).getValues(); // столбец D
        for (var i = 1; i < phoneValues.length; i++) {
          var existingPhone = phoneValues[i][0].toString().replace(/\D/g, "");
          if (existingPhone.length >= 6) {
            if (existingPhone.slice(-6) === last6Digits) {
              duplicateFound = true;
              duplicateRowIndex = i + 1;
              break;
            }
          }
        }
      }

      if (duplicateFound) {
        sheet.getRange(duplicateRowIndex, 1).setValue(dateStr);  // A
        sheet.getRange(duplicateRowIndex, 2).setValue(timeStr);  // B
        sheet.getRange(duplicateRowIndex, 3).setValue(name);     // C
        sheet.getRange(duplicateRowIndex, 12).setValue(tariff);  // L
        sheet.getRange(duplicateRowIndex, 15).setValue("Повтор (Обновлен)"); // O
        backupResult = "DUPLICATE";
      } else {
        var rowData = [];
        rowData[0]  = dateStr;       // A
        rowData[1]  = timeStr;       // B
        rowData[2]  = name;          // C
        rowData[3]  = "'" + phone;   // D (9 цифр как текст)
        rowData[4]  = agreement;     // E
        rowData[5]  = "";            // F
        rowData[6]  = source;        // G
        rowData[7]  = "";            // H
        rowData[8]  = "";            // I
        rowData[9]  = "";            // J
        rowData[10] = "";            // K
        rowData[11] = tariff;        // L
        rowData[12] = "";            // M
        rowData[13] = "Menejer";     // N
        rowData[14] = "Новый";       // O
        sheet.appendRow(rowData);
        backupResult = "NEW";
      }
    } catch (mainErr) {
      backupResult = "MAIN_FAIL";
    }

    // ============================================================
    // ШАГ 3: Дописываем результат в лист "All leads"
    // ============================================================
    if (backupRowIndex > 0) {
      try {
        var backup2 = ss.getSheetByName("All leads");
        if (backup2) {
          backup2.getRange(backupRowIndex, 9).setValue(backupResult || "UNKNOWN"); // I — Результат
        }
      } catch (updErr) {}
    }

    releaseLock(lock);
    return out({ result: "success", status: backupResult });

  } catch (err) {
    releaseLock(lock);
    return out({ result: "error", message: err.toString() });
  }
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
