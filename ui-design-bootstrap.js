import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('data-star-ui="v4"')) {
  const script = String.raw`<script data-star-ui="v4">
(() => {
  const style = document.createElement('style');
  style.textContent = '';
  document.head.appendChild(style);

  function addSidebarTools(){
    const sidebar=document.querySelector('.chat-sidebar');
    if(!sidebar||sidebar.querySelector('.star-side-tools'))return;
    const brand=document.createElement('div');
    brand.className='star-side-brand';
    brand.innerHTML='<span class="side-brand-dot"></span><div><b>STAR AI</b><span> Araçlar</span></div>';
    const title=document.createElement('div');
    title.className='star-side-title';
    title.textContent='AI ARAÇLARI';
    const tools=document.createElement('div');
    tools.className='star-side-tools';
    const items=[['▣','Fotoğraf Düzenle','Fotoğrafı iyileştir ve düzenle','Fotoğrafı profesyonel şekilde düzenle ve doğal görünümünü koru'],['◉','Fotoğraf Analizi','Görüntüyü ayrıntılı analiz et','Bu fotoğrafı ayrıntılı analiz et ve gördüklerini açıkla'],['✎','Metin İyileştirme','Daha profesyonel yaz','Aşağıdaki metni daha profesyonel ve akıcı hale getir'],['◎','Çeviri','Hızlı ve doğru çeviri','Aşağıdaki metni doğru şekilde çevir'],['▤','Özetle','Metni kısaca özetle','Aşağıdaki metni kısa ve anlaşılır şekilde özetle'],['✦','Fikirler','Yaratıcı öneriler üret','Bana yaratıcı ve farklı fikirler ver']];
    items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='star-side-tool';b.innerHTML='<span class="side-icon">'+item[0]+'</span><span><b>'+item[1]+'</b><small>'+item[2]+'</small></span><span class="side-arrow">›</span>';b.addEventListener('click',()=>{const input=document.getElementById('message');if(!input)return;input.value=item[3];input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));if(window.innerWidth<=900)sidebar.classList.remove('star-open');});tools.appendChild(b);});
    const newChat=sidebar.querySelector('.new-chat');
    if(newChat){newChat.insertAdjacentElement('afterend',brand);brand.insertAdjacentElement('afterend',title);title.insertAdjacentElement('afterend',tools);}else{sidebar.prepend(tools);sidebar.prepend(title);sidebar.prepend(brand);}
  }
  function addMobileMenu(){const head=document.querySelector('.chat-main-head');const sidebar=document.querySelector('.chat-sidebar');if(!head||!sidebar||document.querySelector('.star-mobile-menu'))return;const b=document.createElement('button');b.type='button';b.className='star-mobile-menu';b.setAttribute('aria-label','Menüyü aç');b.textContent='☰';b.addEventListener('click',()=>sidebar.classList.toggle('star-open'));head.insertBefore(b,head.firstChild);}
  function enhance(){addSidebarTools();addMobileMenu();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
</script>`;
  dashboard=dashboard.replace('</body>',script+'\n</body>',1);
  fs.writeFileSync(dashboardFile,dashboard);
  console.log('STAR AI Turkish sidebar interface v4 enabled.');
}
