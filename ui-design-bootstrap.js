import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('data-star-ui="v4"')) {
  const script = String.raw`<script data-star-ui="v4">
(() => {
  const style = document.createElement('style');
  style.textContent = '.star-side-brand{display:flex;align-items:center;gap:9px;margin:3px 8px 17px;color:#eaf4fb}.star-side-brand .side-brand-dot{width:9px;height:9px;border-radius:50%;background:#74e2e5;box-shadow:0 0 14px rgba(116,226,229,.55)}.star-side-brand b{font-size:12px;letter-spacing:.04em}.star-side-brand span{color:#758ba0;font-size:9px}.star-side-divider{height:1px;background:rgba(166,196,220,.14);margin:10px 8px 12px}.star-side-title{margin:20px 8px 9px;color:#71869c;font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.star-side-tools{display:flex;flex-direction:column;gap:4px;margin-bottom:14px}.star-side-tool{width:100%;min-height:44px;padding:7px 9px;display:flex;align-items:center;gap:10px;border:1px solid transparent;border-radius:11px;background:transparent;color:#dce7f0;text-align:left;cursor:pointer;transition:background .18s,border-color .18s;font:inherit}.star-side-tool:hover{background:rgba(116,226,229,.055);border-color:rgba(116,226,229,.16)}.star-side-tool:focus-visible{outline:2px solid #74e2e5;outline-offset:2px}.star-side-tool .side-icon{display:grid;place-items:center;flex:0 0 31px;width:31px;height:31px;border:1px solid rgba(116,226,229,.16);border-radius:9px;background:rgba(116,226,229,.07);color:#74e2e5;font-size:14px}.star-side-tool b{font-size:11px;font-weight:700}.star-side-tool small{display:block;margin-top:2px;color:#8194a8;font-size:9px}.star-side-tool .side-arrow{margin-left:auto;color:#6e8297;font-size:16px}@media(max-width:900px){.star-side-tools{gap:3px}.star-side-tool{min-height:43px}}';
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
