/**
 * BARAKA EDU — SALES LAUNCH
 * Отдельный Apps Script для продающей страницы (вебинарный лендинг с тарифами).
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ПРОЕКТ:
 * в одном проекте Apps Script может быть только одна функция doPost().
 * В старом скрипте (форма оферты) doPost уже занят — поэтому этот скрипт
 * создаётся как НОВЫЙ проект со своей таблицей и своим URL.
 *
 * УСТАНОВКА (5 минут):
 * 1. Создай новую Google Таблицу — например «Sales Launch».
 * 2. В ней: Extensions → Apps Script. Удали весь код-заглушку, вставь этот файл.
 * 3. Ничего заполнять не обязательно: лист и шапка создадутся сами при первой заявке.
 *    (TG_TOKEN / TG_CHAT_ID — только если нужны уведомления в Telegram.)
 * 4. Deploy → New deployment → тип Web app:
 *       Execute as:      Me
 *       Who has access:  Anyone          ← обязательно, иначе заявки не дойдут
 * 5. Скопируй Web app URL (…/exec) и пришли мне — я вставлю его в код страницы.
 *
 * ПРОВЕРКА: открой полученный /exec URL прямо в браузере.
 * Должно ответить {"ok":true,...} — значит деплой рабочий.
 *
 * ВАЖНО: после каждого изменения кода нужно Deploy → Manage deployments →
 * Edit (карандаш) → Version: New version → Deploy. Иначе живёт старая версия.
 */

const TG_TOKEN   = '';               // токен от @BotFather (пусто — уведомления выключены)
const TG_CHAT_ID = '';               // id чата/группы менеджеров
const SHEET_NAME = 'Sales Launch';   // имя листа внутри таблицы
const TZ         = 'Asia/Tashkent';

/* Шапка таблицы. Создаётся автоматически, если лист пустой.
   Колонки можно переставлять и удалять прямо в таблице — скрипт пишет
   ПО ИМЕНИ заголовка, а не по номеру, и молча пропускает то, чего нет. */
const HEADERS = [
  'Дата лида', 'Время', 'Имя', 'Телефон', 'Договор',
  'Тариф', 'Источник', 'Maqsad', 'Иш холати', 'Работа',
  'Sahifa', 'Quiz javoblari'
];

/* ---------- Приём заявки ---------- */
function doPost(e) {
  try {
    if (!e || !e.postData) return out({ ok: false, error: 'no body' });

    const data = JSON.parse(e.postData.contents);
    const phone = normalizePhone(data.phone || '');
    if (!phone) return out({ ok: false, error: 'no phone' });

    const lead = {
      name:      String(data.name || '').trim(),
      phone:     phone,
      tariff:    String(data.tariff || ''),
      source:    String(data.source || 'Sales Launch'),
      agreement: String(data.agreement || ''),
      page:      String(data.page || ''),
      cols:      data.cols || {},
      answers:   data.answers || {}
    };

    const row = upsertLead(lead);
    notifyTelegram(lead);

    return out({ ok: true, row: row });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/* ---------- Проверка деплоя из браузера ---------- */
function doGet() {
  return out({ ok: true, sheet: SHEET_NAME, time: new Date().toISOString() });
}

/* ---------- Запись в таблицу: апсерт по телефону ---------- */
function upsertLead(lead) {
  const sh = getSheet();

  // Заголовки → номер колонки (1-based), регистр не важен
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = {};
  headers.forEach(function (h, i) {
    const key = String(h).trim().toLowerCase();
    if (key) idx[key] = i + 1;
  });

  const now = new Date();
  const answersText = Object.keys(lead.answers)
    .map(function (k) { return k + ' → ' + lead.answers[k]; })
    .join('\n');

  const values = {
    'дата лида':       Utilities.formatDate(now, TZ, 'dd.MM.yyyy'),
    'время':           Utilities.formatDate(now, TZ, 'HH:mm:ss'),
    'имя':             lead.name,
    'телефон':         lead.phone,
    'договор':         lead.agreement,
    'тариф':           lead.tariff,
    'источник':        lead.source,
    'sahifa':          lead.page,
    'quiz javoblari':  answersText
  };
  // Ответы квиза, размеченные полем col в конфиге страницы
  Object.keys(lead.cols).forEach(function (c) {
    values[String(c).trim().toLowerCase()] = lead.cols[c];
  });

  const row = findRowByPhone(sh, idx['телефон'], lead.phone) || (sh.getLastRow() + 1);

  Object.keys(values).forEach(function (key) {
    const col = idx[key];
    const val = values[key];
    if (!col || val === '' || val === undefined) return;  // нет такой колонки — пропускаем
    const cell = sh.getRange(row, col);
    if (key === 'телефон') cell.setNumberFormat('@');     // чтобы не терялись ведущие цифры
    cell.setValue(val);
  });

  return row;
}

/* ---------- Лист: берём существующий или создаём с шапкой ---------- */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);

  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    const head = sh.getRange(1, 1, 1, HEADERS.length);
    head.setFontWeight('bold').setBackground('#DCEEE2');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ---------- Поиск существующего лида по номеру ---------- */
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

/* ---------- Уведомление менеджерам ---------- */
function notifyTelegram(lead) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;

  let text = '🔥 <b>Yangi ariza — Sales Launch</b>\n\n' +
    (lead.tariff ? '🏷 Tarif: <b>' + esc(lead.tariff) + '</b>\n' : '') +
    '👤 Ism: ' + esc(lead.name) + '\n' +
    '📞 Tel: <code>+998' + esc(lead.phone) + '</code>';

  const keys = Object.keys(lead.answers);
  if (keys.length) {
    text += '\n\n📋 <b>Quiz javoblari:</b>';
    keys.forEach(function (k) {
      text += '\n▫️ ' + esc(k) + '\n   → <b>' + esc(lead.answers[k]) + '</b>';
    });
  }

  UrlFetchApp.fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: TG_CHAT_ID, text: text, parse_mode: 'HTML' }),
    muteHttpExceptions: true
  });
}

/* ---------- Утилиты ---------- */
function normalizePhone(p) {
  // В таблицу пишем строго 9 цифр: +998 90 123-45-67 → 901234567
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
