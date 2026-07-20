/**
 * BARAKA EDU — приём заявок с barakaeducation.uz
 * Пишет лид в Google Таблицу (апсерт по телефону) + шлёт уведомление в Telegram.
 *
 * УСТАНОВКА:
 * 1. Создай Google Таблицу с листом "Leads" (или переименуй SHEET_NAME ниже).
 * 2. Extensions → Apps Script → вставь этот код.
 * 3. Заполни TG_TOKEN (токен бота) и TG_CHAT_ID (см. инструкцию в чате).
 * 4. Deploy → New deployment → Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Полученный URL вставь в lead.js → APPS_SCRIPT_URL.
 *
 * Токен живёт ТОЛЬКО здесь — на фронтенд его не выносить никогда.
 */

const TG_TOKEN   = 'ВСТАВЬ_ТОКЕН_БОТА';   // токен от @BotFather
const TG_CHAT_ID = 'ВСТАВЬ_CHAT_ID';      // id группы/чата, куда падают заявки
const SHEET_NAME = 'Leads';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const name    = String(data.name || '').trim();
    const phone   = normalizePhone(data.phone || '');
    const course  = String(data.course || 'Noma\'lum');
    const page    = String(data.page || '');
    const answers = data.answers || {};

    if (!phone) return out({ ok: false, error: 'no phone' });

    upsertLead(name, phone, course, page, answers);
    notifyTelegram(name, phone, course, answers);

    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/* ---- Таблица: апсерт по телефону ---- */
function upsertLead(name, phone, course, page, answers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['Sana', 'Ism', 'Telefon', 'Kurs', 'Sahifa', 'Quiz javoblari', 'Yangilangan']);
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm');
  const answersText = Object.keys(answers)
    .map(function(k) { return k + ' → ' + answers[k]; })
    .join('\n');

  // Ищем существующий лид по номеру
  const phones = sh.getRange(2, 3, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < phones.length; i++) {
    if (normalizePhone(String(phones[i][0])) === phone) {
      const row = i + 2;
      sh.getRange(row, 2).setValue(name || sh.getRange(row, 2).getValue());
      sh.getRange(row, 4).setValue(course);
      sh.getRange(row, 5).setValue(page);
      if (answersText) sh.getRange(row, 6).setValue(answersText);
      sh.getRange(row, 7).setValue(now);
      return;
    }
  }

  sh.appendRow([now, name, phone, course, page, answersText, '']);
}

/* ---- Telegram-уведомление менеджерам ---- */
function notifyTelegram(name, phone, course, answers) {
  if (!TG_TOKEN || TG_TOKEN.indexOf('ВСТАВЬ') === 0) return;

  let text = '🔥 <b>Yangi ariza!</b>\n\n' +
    '📚 Kurs: <b>' + esc(course) + '</b>\n' +
    '👤 Ism: ' + esc(name) + '\n' +
    '📞 Tel: <code>' + esc(phone) + '</code>';

  const keys = Object.keys(answers);
  if (keys.length) {
    text += '\n\n📋 <b>Quiz javoblari:</b>';
    keys.forEach(function(k) {
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
  const digits = String(p).replace(/\D/g, '');
  if (!digits) return '';
  // 901234567 → 998901234567
  return digits.length === 9 ? '998' + digits : digits;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
