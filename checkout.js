/* ============================================================
   BARAKA EDU — checkout (3-qadam: to'lov)
   Ariza lead.js'dan URL parametrlari orqali keladi:
   ?tariff=...&name=...&phone=...
   ============================================================ */

/* ---- SOZLAMALAR ----------------------------------------------------
   ⚠️ To'lov havolalari — pul shu hisoblarga tushadi.
   Sotuv menejeri kursi uchun alohida kassa bo'lsa, shu yerni almashtiring.
   -------------------------------------------------------------------- */
const PAY = {
  payme:  'https://transfer.paycom.uz/6a02d39e75b1315d48793cca',
  click:  'https://indoor.click.uz/pay?id=0103073&t=0',
  paynet: 'https://app.paynet.uz/?m=51473'
};

const TG = 'https://t.me/barakaedumanager';
const COURSE = 'Sotuv Menejer';
const DEPOSIT = 350000;

/* Tarif bo'yicha to'liq narx. Narx ma'lum bo'lsa shu yerga qo'shing —
   qiymat bo'lmasa, chizilgan "keyin" narxi umuman ko'rsatilmaydi. */
const FULL_PRICE = {
  // 'STANDART': 4390000,
};

(function () {
  const p = new URLSearchParams(location.search);
  const name = (p.get('name') || '').trim();
  const phone = (p.get('phone') || '').replace(/\D/g, '');
  const tariff = (p.get('tariff') || '').trim();

  /* ---- Ariza ma'lumotlari ---- */
  document.getElementById('leadName').textContent = name || '—';
  document.getElementById('leadPhone').textContent = formatPhone(phone);

  if (tariff) {
    document.getElementById('leadTariff').textContent = tariff;
    document.getElementById('leadTariffRow').hidden = false;
  }

  /* ---- Narx ---- */
  const full = FULL_PRICE[tariff.toUpperCase()];
  const priceBox = document.getElementById('depositDisplay');
  priceBox.textContent = money(DEPOSIT) + ' sum';
  if (full && full > DEPOSIT) {
    const s = document.createElement('div');
    s.className = 'co-price-old';
    s.innerHTML = 'Keyin: <s>' + money(full) + ' sum</s>';
    priceBox.after(s);
  }

  /* ---- To'lov tizimlari ---- */
  document.getElementById('paymeLink').href = PAY.payme;
  document.getElementById('clickLink').href = PAY.click;
  document.getElementById('paynetLink').href = PAY.paynet;

  /* ---- Muddatli to'lov → Telegram, tayyor matn bilan ---- */
  document.getElementById('uzumLink').href =
    tg("Assalomu Aleykum, men " + COURSE + " kursini Uzum Nasiya muddatli to'lovi orqali harid qilmoqchiman.");
  document.getElementById('paylaterLink').href =
    tg("Assalomu Aleykum, men " + COURSE + " kursini Paylater muddatli to'lovi orqali harid qilmoqchiman.");

  /* ---- Yordam → Telegram, ism va raqam bilan ---- */
  document.getElementById('tgSupportLink').href =
    tg("Assalomu Aleykum, men " + COURSE + " kursini harid qilmoqchiman. Menga yordam kerak."
      + (name ? "\n" + name : '')
      + (phone ? "\n+998" + phone : ''));

  /* ---- Yordamchi funksiyalar ---- */
  function tg(text) {
    return TG + '?text=' + encodeURIComponent(text);
  }

  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatPhone(d) {
    if (d.length !== 9) return d ? '+998 ' + d : '—';
    return '+998 (' + d.slice(0, 2) + ') ' + d.slice(2, 5) + '-XX-XX';
  }
})();
