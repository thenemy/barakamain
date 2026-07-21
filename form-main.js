// Общая форма на главной
  document.getElementById('g-submit').addEventListener('click', async function(){
    const name = document.getElementById('g-name').value.trim();
    const phone = document.getElementById('g-phone').value.trim();
    const err = document.getElementById('g-err');
    if(name.length < 2 || phone.replace(/\D/g,'').length < 9){
      err.style.display = 'block';
      return;
    }
    err.style.display = 'none';
    this.disabled = true;
    this.textContent = 'Yuborilmoqda...';
    await sendLead({
      course: 'Umumiy ariza (kurs tanlanmagan)',
      name: name,
      phone: phone,
      answers: {}
    });
    document.getElementById('g-done').style.display = 'block';
    this.style.display = 'none';
  });
