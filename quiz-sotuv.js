initQuiz({
    courseName: 'Sotuv menejeri: 0 dan natijagacha',
    tariff: 'SOTUV MENEJERI',
    checkoutUrl: '/checkout',
    // col — имя колонки в Google-таблице, куда падает ответ.
    // Без col ответ всё равно уходит в общую колонку «Quiz javoblari».
    questions: [
      { q: 'Yoshingiz nechada?', col: 'Возраст',
        opts: ['17–19', '20–25', '26–35', '36+'] },
      { q: 'Hozir sotuv sohasiga qanchalik yaqinsiz?', col: 'Работа',
        opts: ['Sotuvda ishlayman', 'Yaqin sohada ishlayman (operator va h.k.)', 'Boshqa sohadaman, kasb almashtirmoqchiman', "Umuman yangi boshlovchiman"] },
      { q: 'Sotuv orqali oyiga qancha daromad topishni xohlaysiz?', col: 'Maqsad',
        opts: ["$500 bo'lsa, yaxshi bo'lardi", "$1000 bo'lsa, xarajatlarimga yetadi", "$1500+ bo'lsa, barcha ehtiyojlarimni qoplaydi"] },
      { q: "O'quv jarayonini qanchalik tez boshlashga tayyorsiz?",
        opts: ["Kerak bo'lsa, ertadan boshlayman!", '1–2 hafta ichida', '1 oy ichida', 'Hali aniq emas'] },
      { q: "O'qish uchun mablag' va vaqt ajratishga tayyormisiz?", col: 'Bilim',
        opts: ['Ha, albatta tayyorman!', 'Biroz ikkilanish bor', "Yo'q, hozircha tayyor emasman"] },
      { q: 'Sizning hozirgi moliyaviy holatingiz qanday?', col: 'Иш холати',
        opts: ['Barqaror daromadim bor', "Vaqtincha daromadim yo'q", 'Oilam ta\'minlaydi', 'Talabaman'] }
    ]
  });
