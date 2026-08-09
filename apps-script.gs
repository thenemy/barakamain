/**
 * BARAKA EDU — приём заявок с barakaeducation.uz
 * Пишет лид в Google Таблицу (апсерт по телефону) + шлёт уведомление в Telegram.
 *
 * Скрипт работает ПО ЗАГОЛОВКАМ таблицы: он читает первую строку и кладёт
 * значения в колонки с совпадающими именами. Порядок колонок можно менять,
 * лишние — удалять; ничего в коде править не нужно.
 *
 * Поддерживаемые заголовки (пишутся, если такая колонка есть):
 *   Дата лида · Время · Имя · Телефон · Договор · Источник · Тариф
 *   + любые колонки из quiz-*.js (Возраст, Bilim, Maqsad, Иш холати, Работа, ...)
 *   + Quiz javoblari — сводка всех ответов одной ячейкой
 *
 * УСТАНОВКА:
 * 1. Открой свою таблицу с лидами → Extensions → Apps Script → вставь этот код.
 * 2. Впиши SHEET_NAME — имя листа (см. ярлык внизу таблицы).
 * 3. Заполни TG_TOKEN / TG_CHAT_ID, если нужны уведомления в Telegram (необязательно).
 * 4. Deploy → New deployment → Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Полученный URL вставь в lead.js → APPS_SCRIPT_URL.
 *
 * Токен живёт ТОЛЬКО здесь — на фронтенд его не выносить никогда.
 */

const TG_TOKEN   = '';        // токен от @BotFather (пусто — уведомления выключены)
const TG_CHAT_ID = '';        // id группы/чата, куда падают заявки
const SHEET_NAME = 'Leads';   // имя листа в таблице
const TZ         = 'Asia/Tashkent';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const name    = String(data.name || '').trim();
    const phone   = normalizePhone(data.phone || '');
    const course  = String(data.course || '');
    const tariff  = String(data.tariff || '');
    const source  = String(data.source || 'Сайт');
    const agree   = String(data.agreement || '');
    const cols    = data.cols || {};
    const answers = data.answers || {};

    if (!phone) return out({ ok: false, error: 'no phone' });

    upsertLead({
      name: name, phone: phone, course: course, tariff: tariff,
      source: source, agreement: agree, cols: cols, answers: answers
    });

    notifyTelegram(name, phone, course, tariff, answers);

    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/* ---- Таблица: апсерт по телефону, запись по заголовкам ---- */
function upsertLead(lead) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const lastCol = sh.getLastColumn();
  if (!lastCol) throw new Error('Пустой лист: нужна строка заголовков');

  // Заголовки → номер колонки (1-based)
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = {};
  headers.forEach(function (h, i) {
    const key = String(h).trim();
    if (key) idx[key.toLowerCase()] = i + 1;
  });

  const now = new Date();
  const answersText = Object.keys(lead.answers)
    .map(function (k) { return k + ' → ' + lead.answers[k]; })
    .join('\n');

  // Что кладём в какие колонки
  const values = {
    'дата лида': Utilities.formatDate(now, TZ, 'dd.MM.yyyy'),
    'время':     Utilities.formatDate(now, TZ, 'HH:mm:ss'),
    'имя':       lead.name,
    'телефон':   lead.phone,
    'договор':   lead.agreement,
    'источник':  lead.source,
    'тариф':     lead.tariff,
    'курс':      lead.course,
    'quiz javoblari': answersText
  };
  // Ответы квиза, размеченные полем col в quiz-*.js
  Object.keys(lead.cols).forEach(function (c) {
    values[String(c).trim().toLowerCase()] = lead.cols[c];
  });

  const row = findRowByPhone(sh, idx['телефон'], lead.phone) || (sh.getLastRow() + 1);

  Object.keys(values).forEach(function (key) {
    const col = idx[key];
    const val = values[key];
    if (!col || val === '' || val === undefined) return;   // нет колонки / нечего писать
    const cell = sh.getRange(row, col);
    if (key === 'телефон') cell.setNumberFormat('@');      // чтобы не терять ведущие цифры
    cell.setValue(val);
  });
}

/* ---- Поиск существующего лида по номеру ---- */
function findRowByPhone(sh, phoneCol, phone) {
  if (!phoneCol) return null;
  const last = sh.getLastRow();
  if (last < 2) return null;

  const vals = sh.getRange(2, phoneCol, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (normalizePhone(String(vals[i][0])) === phone) return i + 2;
  }
  return null;
}

/* ---- Telegram-уведомление менеджерам ---- */
function notifyTelegram(name, phone, course, tariff, answers) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;

  let text = '🔥 <b>Yangi ariza!</b>\n\n' +
    (course ? '📚 Kurs: <b>' + esc(course) + '</b>\n' : '') +
    (tariff ? '🏷 Tarif: <b>' + esc(tariff) + '</b>\n' : '') +
    '👤 Ism: ' + esc(name) + '\n' +
    '📞 Tel: <code>+998' + esc(phone) + '</code>';

  const keys = Object.keys(answers);
  if (keys.length) {
    text += '\n\n📋 <b>Quiz javoblari:</b>';
    keys.forEach(function (k) {
      text += '\n▫️ ' + esc(k) + '\n   → <b>' + esc(answers[k]) + '</b>';
    });
  }

  UrlFetchApp.fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    }),
    muteHttpExceptions: true
  });
}

/* ---- Утилиты ---- */
function normalizePhone(p) {
  // В таблицу пишем строго 9 цифр: 998901234567 / +998 90 123-45-67 → 901234567
  const digits = String(p).replace(/\D/g, '');
  return digits ? digits.slice(-9) : '';
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
