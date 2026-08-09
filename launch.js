/* ============================================
   BARAKA EDU — Лендинг "Moliyaviy erkinlik"
   Таймер, бегущая строка (симуляция), модалка с формой
   ============================================ */

// ─── Таймер обратного отсчёта ──────────────────────
const KURS_SANASI = new Date('2026-08-16T20:00:00+05:00'); // 16-avgust, 20:00 (Toshkent)

(function initTimer() {
    const pad = n => String(n).padStart(2, '0');
    const els = {
        d: document.getElementById('t-days'),
        h: document.getElementById('t-hours'),
        m: document.getElementById('t-mins'),
        s: document.getElementById('t-secs')
    };
    if (!els.d) return;

    let prev = {};

    function tick() {
        const now = new Date();
        let diff = Math.max(0, KURS_SANASI - now);
        const d = Math.floor(diff / 86400000); diff -= d * 86400000;
        const h = Math.floor(diff / 3600000); diff -= h * 3600000;
        const mn = Math.floor(diff / 60000); diff -= mn * 60000;
        const s = Math.floor(diff / 1000);

        const vals = { d, h, m: mn, s };
        for (const k in vals) {
            const el = els[k];
            const v = pad(vals[k]);
            if (prev[k] !== v) {
                el.classList.add('flip');
                setTimeout(() => {
                    el.textContent = v;
                    el.classList.remove('flip');
                }, 75);
                prev[k] = v;
            }
        }
    }

    tick();
    setInterval(tick, 1000);
})();

// ─── Бегущая строка регистраций (соц. доказательство) ──
(function initRegistrationTicker() {
    const inner = document.getElementById('reg-ticker-inner');
    if (!inner) return;

    const MALE_NAMES = [
        'Bobur', 'Jasur', 'Sherzod', 'Otabek', 'Aziz', 'Sardor', 'Davron',
        'Dilshod', 'Sanjar', 'Ulugbek', 'Farrux', 'Akmal', 'Shoxrux', 'Asilbek'
    ];
    const FEMALE_NAMES = [
        'Gulnora', 'Madina', 'Sevinch', 'Dilnoza', 'Nodira', 'Kamola', 'Zarina',
        'Feruza', 'Malika', 'Nilufar', 'Shahnoza', 'Munisa', 'Diyora', 'Lobar'
    ];
    const CITIES = [
        'Toshkent', 'Samarqand', 'Buxoro', 'Namangan', 'Andijon',
        "Farg'ona", 'Qarshi', 'Nukus', 'Jizzax', 'Urganch'
    ];
    const TARIFFS = [
        { name: 'VIP', weight: 65 },
        { name: 'STANDART', weight: 18 },
        { name: 'ECONOM', weight: 10 },
        { name: 'SHOGIRD', weight: 7 }
    ];
    const TIME_AGO = ['2 daqiqa', '3 daqiqa', '5 daqiqa', '8 daqiqa', '12 daqiqa', '20 daqiqa'];

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function pickWeightedTariff() {
        const total = TARIFFS.reduce((sum, t) => sum + t.weight, 0);
        let r = Math.random() * total;
        for (const t of TARIFFS) {
            if (r < t.weight) return t.name;
            r -= t.weight;
        }
        return TARIFFS[0].name;
    }

    function randomInitial() {
        const letters = 'ABDEFGHIJKLMNOPQRSTUVZ';
        return letters[Math.floor(Math.random() * letters.length)] + '.';
    }

    function buildEntry() {
        const isMale = Math.random() < 0.5;
        const name = pick(isMale ? MALE_NAMES : FEMALE_NAMES);
        const city = pick(CITIES);
        const tariff = pickWeightedTariff();
        const time = pick(TIME_AGO);
        return `<span class="reg-ticker-item">🟢 <strong>${name} ${randomInitial()}</strong> (${city}) — <em>${tariff}</em> tarifini tanladi, ${time} oldin</span>`;
    }

    function buildTicker() {
        const items = [];
        for (let i = 0; i < 20; i++) {
            items.push(buildEntry());
        }
        const html = items.join('');
        inner.innerHTML = html + html;
    }

    buildTicker();
})();

// ─── Модальное окно и обработка формы ──────────────────
// ─── Модальное окно и обработка формы ──────────────────
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('modalOverlay');
    const displayTariff = document.getElementById('tariffNameDisplay');
    const inputTariff = document.getElementById('selectedTariff');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('regForm');

    // Открытие модалки при клике на ЛЮБУЮ кнопку тарифа
    document.querySelectorAll('.tariff-btn, .reserve-btn').forEach(button => {
        button.addEventListener('click', function() {
            const tariff = this.getAttribute('data-tariff');
            if(modal && tariff) {
                displayTariff.innerText = tariff;
                inputTariff.value = tariff;
                modal.style.display = 'flex';
            }
        });
    });

    // Закрытие модалки
    if(closeBtn) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }
    if(modal) {
        modal.addEventListener('click', (e) => { if(e.target === modal) modal.style.display = 'none'; });
    }

    // Железобетонный обработчик отправки формы (Строго последние 9 цифр)
    if(form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const agreementCheckbox = document.getElementById('agreement');
            if (agreementCheckbox && !agreementCheckbox.checked) {
                alert("Iltimos, ommaviy oferta shartlariga rozilik bering.");
                return;
            }

            const formData = new FormData(this);
            const rawName = (formData.get('name') || '').trim();
            let userDigits = (formData.get('phone') || '').replace(/\D/g, '');

            if (userDigits.length < 9) {
                alert("Iltimos, telefon raqamingizni to'liq kiriting.");
                return;
            }

            // Вырезаем строго последние 9 цифр базы
            const final9Digits = userDigits.slice(-9);
            const selectedTariff = formData.get('tariff') || 'ECONOM';

            // Префикс lead_ — по нему Apps Script кладёт заявку в лист "Selling page".
            // Имена полей менять нельзя: маршрутизация завязана именно на них.
            const payload = {
              lead_name: rawName,
              lead_phone: final9Digits, // В таблицу падает чистая 9-значная строка
              lead_tariff: selectedTariff,
              lead_source: 'Selling page',
              lead_agreement: agreementCheckbox ? (agreementCheckbox.checked ? "Принял" : "Нет") : "Да"
            };

            // Отдельная таблица Baraka Edu (Sotuv menejeri), НЕ таблица тарифного сайта
            const url = 'https://script.google.com/macros/s/AKfycbz97aQC9hzCAMkBYNLLlAl34HkjMaF5OrS8JlK9wDIyHDKYb1a5kgT0NAzOC-0AnIhi/exec';

            // Куда уходим после отправки
            const checkoutUrl = `checkout.html?tariff=${encodeURIComponent(selectedTariff)}&name=${encodeURIComponent(rawName)}&phone=${encodeURIComponent(final9Digits)}`;

            // Чтобы редирект не выполнился дважды (fetch + подстраховка по таймеру)
            let redirected = false;
            function goToCheckout() {
                if (redirected) return;
                redirected = true;
                window.location.href = checkoutUrl;
            }

            // Отправка с retry: до 3 попыток. Если сеть/скрипт тупит — повторяем,
            // чтобы лид не потерялся при наплыве. keepalive гарантирует доставку
            // даже когда страница уже уходит на checkout.
            function sendLead(attempt) {
                fetch(url, {
                    method: 'POST',
                    keepalive: true,
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                })
                .then(function (res) {
                    if (res && res.ok) {
                        goToCheckout(); // успех — уходим на оплату
                    } else if (attempt < 3) {
                        setTimeout(function () { sendLead(attempt + 1); }, 300);
                    } else {
                        goToCheckout(); // попытки исчерпаны — всё равно на оплату
                    }
                })
                .catch(function (err) {
                    console.error("Fetch error (попытка " + attempt + "):", err);
                    if (attempt < 3) {
                        setTimeout(function () { sendLead(attempt + 1); }, 300);
                    } else {
                        goToCheckout(); // данные, вероятно, ушли благодаря keepalive
                    }
                });
            }

            try {
                sendLead(1);
            } catch (err) {
                console.error("Send error:", err);
                goToCheckout();
            }

            // Жёсткая подстраховка: человек уходит на оплату максимум через 1.2 сек
            // (успеваем на 1 быстрый retry). keepalive довезёт данные в фоне,
            // а бэкап-лист "All leads" пишется первым — лид не потеряется.
            setTimeout(goToCheckout, 1200);
        });
    }
});
// ─── Анимация появления секций при скролле (.reveal → .in) ──
(function initRevealOnScroll() {
    var revealEls = document.querySelectorAll('.reveal');
    if (!revealEls.length) return;

    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('in');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.12 });
        revealEls.forEach(function (el) { io.observe(el); });
    } else {
        // Фолбэк для старых браузеров — просто показываем всё
        revealEls.forEach(function (el) { el.classList.add('in'); });
    }
})();