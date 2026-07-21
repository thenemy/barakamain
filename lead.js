/* ============================================================
   BARAKA EDU — отправка заявок + движок квиза
   Токен бота хранится ТОЛЬКО в Apps Script (сервер-сайд).
   Сюда вставляется только URL веб-приложения Apps Script.
   ============================================================ */

const APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE';

async function sendLead(payload) {
  payload.page = location.pathname;
  payload.ts = new Date().toISOString();
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script не отдаёт CORS-заголовки — ответ не читаем, но заявка доходит
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (e) {
    console.error('Lead send failed', e);
    return false;
  }
}

/* ---------- Квиз ---------- */
function initQuiz(config) {
  // config: { courseName, questions: [{q, opts:[...]}] }
  const card = document.getElementById('quiz');
  if (!card) return;

  const answers = {};
  let step = 0;
  const total = config.questions.length + 1; // + финальный шаг с контактами

  const bar = card.querySelector('.quiz-progress i');
  const stepsWrap = card.querySelector('.quiz-steps');

  // Рендер шагов с вопросами
  config.questions.forEach((item, qi) => {
    const div = document.createElement('div');
    div.className = 'quiz-step';
    div.innerHTML =
      '<p class="quiz-q">' + item.q + '</p>' +
      '<div class="quiz-opts">' +
      item.opts.map(o => '<button type="button" class="quiz-opt">' + o + '</button>').join('') +
      '</div>';
    stepsWrap.appendChild(div);

    div.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        answers[item.q] = btn.textContent;
        div.querySelectorAll('.quiz-opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        setTimeout(() => go(step + 1), 180);
      });
    });
  });

  // Финальный шаг — контакты
  const fin = document.createElement('div');
  fin.className = 'quiz-step';
  fin.innerHTML =
    '<p class="quiz-q">Ajoyib! Natijangizni menejerimiz siz bilan muhokama qiladi</p>' +
    '<div class="quiz-field"><label>Ismingiz</label><input type="text" id="q-name" placeholder="Ismingizni yozing" autocomplete="name"></div>' +
    '<div class="quiz-field"><label>Telefon raqamingiz</label><input type="tel" id="q-phone" placeholder="+998 90 123 45 67" autocomplete="tel"></div>' +
    '<button class="btn btn-primary btn-block" id="q-submit">Yuborish</button>' +
    '<div class="quiz-err" id="q-err">Iltimos, ism va telefon raqamingizni to\'g\'ri kiriting.</div>' +
    '<div class="quiz-note">Tugmani bosish orqali siz shaxsiy ma\'lumotlaringizni qayta ishlashga rozilik bildirasiz.</div>';
  stepsWrap.appendChild(fin);

  // Экран «готово»
  const done = document.createElement('div');
  done.className = 'quiz-step';
  done.innerHTML =
    '<div class="quiz-done"><div class="big">✅</div>' +
    '<h3>Arizangiz qabul qilindi!</h3>' +
    '<p>Menejerlarimiz tez orada siz bilan bog\'lanib, barcha savollaringizga javob beradi.</p></div>';
  stepsWrap.appendChild(done);

  const allSteps = stepsWrap.querySelectorAll('.quiz-step');

  function go(n) {
    step = n;
    allSteps.forEach((s, i) => s.classList.toggle('active', i === n));
    bar.style.width = Math.min(100, Math.round((n / total) * 100)) + '%';
  }

  fin.querySelector('#q-submit').addEventListener('click', async function () {
    const name = fin.querySelector('#q-name').value.trim();
    const phone = fin.querySelector('#q-phone').value.trim();
    const err = fin.querySelector('#q-err');
    if (name.length < 2 || phone.replace(/\D/g, '').length < 9) {
      err.style.display = 'block';
      return;
    }
    err.style.display = 'none';
    this.disabled = true;
    this.textContent = 'Yuborilmoqda...';
    await sendLead({
      course: config.courseName,
      name: name,
      phone: phone,
      answers: answers
    });
    bar.style.width = '100%';
    go(allSteps.length - 1);
  });

  go(0);
}

/* ---------- Аккордеон: открыт только один (фолбэк для браузеров без details[name]) ---------- */
(function () {
  var supportsName = 'name' in document.createElement('details');
  if (supportsName) return;
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.tagName !== 'DETAILS' || !d.open || !d.name) return;
    document.querySelectorAll('details[name="' + d.name + '"]').forEach(function (o) {
      if (o !== d) o.open = false;
    });
  }, true);
})();
