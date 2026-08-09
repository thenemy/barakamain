/* ============================================================
   BARAKA EDU — SOTUV MENEJERI, sotuv sahifasi (tariflar)
   Ariza → Google Sheets (list "Selling page") → /checkout

   Vebinar vaqtida shu sahifa havolasi Telegram/YouTube chatga tashlanadi.
   ============================================================ */

/* ---- SOZLAMALAR ---------------------------------------------------- */
const LEAD_URL = 'https://script.google.com/macros/s/AKfycbz97aQC9hzCAMkBYNLLlAl34HkjMaF5OrS8JlK9wDIyHDKYb1a5kgT0NAzOC-0AnIhi/exec';
const TG_LINK  = 'https://t.me/barakaedumanager';
const COURSE   = 'Sotuv Menejer';
const DEPOSIT  = 350000;   // joyni band qilish uchun oldindan to'lov

/* ⚠️ Kurs boshlanish sanasi — taymer shu vaqtgacha sanaydi.
   Vebinardan oldin shu qatorni o'zgartiring (Toshkent vaqti). */
const START_AT = '2026-08-16T19:00:00+05:00';

/* Narxlarni faqat shu yerda o'zgartiring — qolgan kod tegilmaydi.
   old — chizib tashlanadigan eski narx (0 bo'lsa ko'rsatilmaydi). */
const TARIFFS = [
  {
    id: 'ECONOM',
    price: 1990000,
    old: 5000000,
    note: 'Mustaqil o\'rganish uchun',
    feats: [
      'Kursning barcha video darslari',
      'Amaliy topshiriqlar va testlar',
      'Yopiq Telegram kanal',
      'Yakuniy sertifikat'
    ]
  },
  {
    id: 'STANDART',
    price: 4390000,
    old: 8000000,
    note: 'Kurator yordami bilan',
    feats: [
      'ECONOM tarifidagi hamma narsa',
      'Shaxsiy kurator qo\'llab-quvvatlashi',
      'Uy vazifalarini tekshirish',
      'Savol-javob sessiyalari'
    ]
  },
  {
    id: 'VIP',
    price: 4990000,
    old: 10000000,
    best: true,
    note: 'Ishga joylashish kafolati bilan',
    feats: [
      'STANDART tarifidagi hamma narsa',
      'Haftasiga 3 marta Zoom uchrashuv',
      'Real mijozlar bazasi — kurs davomida amaliyot va real daromad',
      'Qo\'ng\'iroq yozuvlarini Nodirxon va kurator bilan birga tahlil qilish',
      'Kursni muvaffaqiyatli tugatgach — Pushkin metrosi yonidagi ofisimizda ishlash kafolati'
    ]
  },
  {
    id: 'SHOGIRD',
    price: 14990000,
    old: 25000000,
    note: 'Shaxsan Nodirxon bilan',
    feats: [
      'VIP tarifidagi hamma narsa',
      'Offline shogirdlik — yonma-yon ishlash',
      'Shaxsiy mentorlik va individual reja',
      'Cheklangan joy soni'
    ]
  }
];

/* ---- Tariflarni chizish --------------------------------------------- */
(function renderTariffs() {
  const wrap = document.getElementById('tariffs');
  if (!wrap) return;

  TARIFFS.forEach(t => {
    const card = document.createElement('article');
    card.className = 'tf' + (t.best ? ' tf-best' : '');
    card.innerHTML =
      (t.best ? '<div class="tf-badge">★ Mening tavsiyam</div>' : '') +
      '<div class="tf-head">' +
        '<div>' +
          '<h3 class="tf-name">' + t.id + '</h3>' +
          '<div class="tf-note">' + t.note + '</div>' +
        '</div>' +
        '<div class="tf-prices">' +
          (t.old ? '<div class="tf-old"><s>' + money(t.old) + '</s></div>' : '') +
          '<div class="tf-price">' + money(t.price) + ' <span>sum</span></div>' +
        '</div>' +
      '</div>' +
      '<ul class="tf-feats">' +
        t.feats.map(f => '<li>' + f + '</li>').join('') +
      '</ul>' +
      '<div class="tf-cta">' +
        '<div class="tf-book">Band qilish: <b>' + money(DEPOSIT) + ' sum</b></div>' +
        '<button type="button" class="btn btn-primary tf-pick" data-tariff="' + t.id + '">Tanlash</button>' +
      '</div>';
    wrap.appendChild(card);
  });

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.tf-pick');
    if (btn) openForm(btn.dataset.tariff);
  });
})();

/* ---- Modal forma ----------------------------------------------------- */
const modal    = document.getElementById('modal');
const formEl   = document.getElementById('leadForm');
const pickedEl = document.getElementById('pickedTariff');
const errEl    = document.getElementById('formErr');
let picked = '';

function openForm(tariff) {
  picked = tariff || '';
  pickedEl.textContent = picked || '—';
  errEl.style.display = 'none';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('fName').focus(), 60);
}

function closeForm() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('modalClose').addEventListener('click', closeForm);
modal.addEventListener('click', e => { if (e.target === modal) closeForm(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.hidden) closeForm();
});

/* ---- Yuborish -------------------------------------------------------- */
formEl.addEventListener('submit', async function (e) {
  e.preventDefault();

  const name  = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const agree = document.getElementById('fAgree').checked;
  // Faqat oxirgi 9 raqam: +998 90 111 22 33 → 901112233.
  // checkout.js va Apps Script ikkalasi ham 9 xonali formatni kutadi.
  let digits = phone.replace(/\D/g, '');
  if (digits.length > 9) digits = digits.slice(-9);

  if (name.length < 2 || digits.length < 9 || !agree) {
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const btn = document.getElementById('fSubmit');
  btn.disabled = true;
  btn.textContent = 'Yuborilmoqda...';

  /* Maydon nomlari lead_ prefiksi bilan — skript shu bo'yicha
     arizani "Selling page" listiga yo'naltiradi. */
  await sendLead({
    lead_name:      name,
    lead_phone:     digits,
    lead_tariff:    picked,
    lead_agreement: agree ? 'Принял' : 'Нет'
  });

  // 3-qadam: to'lov sahifasi
  location.href = '/checkout?tariff=' + encodeURIComponent(picked) +
                  '&name=' + encodeURIComponent(name) +
                  '&phone=' + encodeURIComponent(digits);
});

async function sendLead(payload) {
  payload.page = location.pathname;
  try {
    await fetch(LEAD_URL, {
      method: 'POST',
      mode: 'no-cors',           // Apps Script CORS sarlavhalarini bermaydi
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Lead send failed', err);
    // Ariza ketmasa ham foydalanuvchini to'lovda ushlab qolmaymiz —
    // menejer bilan bog'lanish tugmasi checkout sahifasida bor.
  }
}

/* ---- Telegram tugmasi ------------------------------------------------ */
const tgBtn = document.getElementById('tgAsk');
if (tgBtn) {
  tgBtn.href = TG_LINK + '?text=' +
    encodeURIComponent('Assalomu Aleykum, men ' + COURSE + ' kursini harid qilmoqchiman');
}

/* ---- Taymer ---------------------------------------------------------- */
(function countdown() {
  const box = document.getElementById('timer');
  if (!box) return;

  const target = new Date(START_AT).getTime();
  if (isNaN(target)) return;             // sana noto'g'ri bo'lsa — taymerni ko'rsatmaymiz

  const units = [
    ['kun', 86400000],
    ['soat', 3600000],
    ['daqiqa', 60000],
    ['soniya', 1000]
  ];

  function tick() {
    let left = target - Date.now();
    if (left <= 0) {
      box.innerHTML = '<div class="tm-live">Kurs boshlandi!</div>';
      clearInterval(id);
      return;
    }
    box.innerHTML = units.map(([label, ms]) => {
      const v = Math.floor(left / ms);
      left -= v * ms;
      return '<div class="tm-cell"><b>' + String(v).padStart(2, '0') + '</b><span>' + label + '</span></div>';
    }).join('');
  }

  tick();
  const id = setInterval(tick, 1000);
})();

/* ---- Yordamchi ------------------------------------------------------- */
function money(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
