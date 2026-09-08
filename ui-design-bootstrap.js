import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('data-star-ui="v2"')) {
  const script = String.raw`<script data-star-ui="v2">
(() => {
  const style = document.createElement('style');
  style.textContent = `
  :root{--star-bg:#05050b;--star-panel:rgba(14,12,25,.78);--star-panel-2:rgba(21,17,37,.72);--star-line:rgba(255,255,255,.08);--star-muted:#858096;--star-purple:#7c3cff;--star-violet:#b45cff;--star-blue:#4f7cff;--star-green:#39d99b}
  .dashboard-page{background:radial-gradient(900px 500px at 68% -5%,rgba(124,60,255,.18),transparent 62%),radial-gradient(700px 420px at 20% 100%,rgba(79,124,255,.08),transparent 60%),var(--star-bg)!important}
  .dashboard-page .dash-nav{height:70px;min-height:70px;padding:0 24px;background:rgba(5,5,11,.72);border-bottom:1px solid var(--star-line);box-shadow:0 10px 40px rgba(0,0,0,.18)}
  .dashboard-page .brand{font-size:20px;letter-spacing:-.03em;text-decoration:none}.dashboard-page .brand b{color:#a75cff}
  .dashboard-page .dash-user{gap:10px}.dashboard-page .credits-pill{display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid rgba(168,85,247,.22);border-radius:12px;background:rgba(124,60,255,.09);color:#bfa7ff;font-size:12px}
  .dashboard-page .credits-pill b{color:#fff}.dashboard-page .logout{border-color:var(--star-line);background:rgba(255,255,255,.025);border-radius:12px}
  .dashboard-shell{height:calc(100vh - 70px);height:calc(100dvh - 70px);grid-template-columns:258px minmax(0,1fr);position:relative}
  .chat-sidebar{padding:20px 14px;background:linear-gradient(180deg,rgba(10,9,18,.94),rgba(7,6,13,.82));border-right:1px solid var(--star-line);box-shadow:12px 0 60px rgba(0,0,0,.18)}
  .new-chat{height:50px;border-radius:15px;background:linear-gradient(135deg,#6f35f5,#a74dff);border:1px solid rgba(205,167,255,.28);box-shadow:0 14px 34px rgba(124,60,255,.25);font-size:13px}
  .new-chat span{font-size:20px}.sidebar-label{margin:25px 10px 9px;color:#625d70;font-size:9px;letter-spacing:.18em}
  .conversation-item{min-height:44px;margin:3px 0;border-radius:12px;color:#9993a7}.conversation-item.active{background:linear-gradient(90deg,rgba(124,60,255,.17),rgba(124,60,255,.04));border-color:rgba(168,85,247,.18);box-shadow:inset 3px 0 0 #9a5cff}.conversation-title{font-size:12px}
  .sidebar-bottom{padding-top:14px}.credit-mini{padding:14px;border:1px solid rgba(168,85,247,.16);background:linear-gradient(135deg,rgba(124,60,255,.12),rgba(255,255,255,.025));border-radius:16px}.credit-mini b{font-size:21px}.credit-mini span{font-size:10px;font-weight:800}
  .chat-main{background:transparent}
  .chat-main-head{height:70px;padding:0 34px;background:rgba(7,6,14,.5);border-bottom:1px solid rgba(255,255,255,.055)}
  .assistant-avatar{width:40px;height:40px;border-radius:14px;background:radial-gradient(circle at 35% 25%,#d6bdff 0 4%,#9d55ff 18%,#5924d8 70%);box-shadow:0 0 28px rgba(124,60,255,.38);font-size:19px}
  .chat-title b{font-size:14px}.chat-title small{font-size:10px}.online-dot{width:6px;height:6px}
  .chat-actions .chat-action{border-radius:12px;background:rgba(255,255,255,.025)}
  .dashboard-page #messages{padding:34px clamp(16px,5vw,74px) 34px;scrollbar-color:rgba(168,85,247,.3) transparent}
  .messages-inner{width:min(980px,100%)}
  .dashboard-page .msg{font-size:16px;line-height:1.72;border-radius:18px;padding:14px 18px;box-shadow:0 12px 30px rgba(0,0,0,.12)}
  .dashboard-page .msg.ai{background:linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border-color:rgba(255,255,255,.075)}
  .dashboard-page .msg.user{background:linear-gradient(135deg,#6932ed,#4d20b4);border-color:rgba(190,151,255,.32);box-shadow:0 14px 38px rgba(75,32,180,.25)}
  .welcome{max-width:860px;margin:5vh auto 3vh;text-align:center;position:relative}
  .welcome:before{content:'';position:absolute;width:420px;height:180px;left:50%;top:-50px;transform:translateX(-50%);background:radial-gradient(ellipse,rgba(124,60,255,.18),transparent 68%);filter:blur(12px);pointer-events:none}
  .welcome .welcome-icon{position:relative;width:72px;height:72px;margin:0 auto 20px;border-radius:23px;background:radial-gradient(circle at 35% 25%,#dfcfff,#9b52ff 28%,#5222c8 72%);box-shadow:0 0 55px rgba(124,60,255,.3),inset 0 1px 1px rgba(255,255,255,.25);font-size:33px}
  .welcome h1{position:relative;margin-bottom:10px;font-size:clamp(31px,4.2vw,48px);font-weight:850;letter-spacing:-.055em;background:linear-gradient(90deg,#fff,#d9ccff 55%,#a66bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .welcome p{position:relative;color:#8c869a;font-size:14px}
  .star-tools{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:0 auto 28px;width:min(980px,100%)}
  .star-tool{min-height:100px;padding:14px 10px;border:1px solid rgba(255,255,255,.08);border-radius:17px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));color:#ddd8e8;text-align:center;cursor:pointer;transition:.2s;box-shadow:0 10px 30px rgba(0,0,0,.08)}
  .star-tool:hover{transform:translateY(-2px);border-color:rgba(168,85,247,.3);background:linear-gradient(180deg,rgba(124,60,255,.12),rgba(255,255,255,.02));box-shadow:0 16px 34px rgba(0,0,0,.18),0 0 25px rgba(124,60,255,.08)}
  .star-tool .tool-icon{display:grid;place-items:center;width:36px;height:36px;margin:0 auto 9px;border-radius:11px;background:linear-gradient(135deg,rgba(124,60,255,.95),rgba(82,117,255,.9));box-shadow:0 7px 18px rgba(124,60,255,.2);font-size:16px}.star-tool:nth-child(2) .tool-icon{background:linear-gradient(135deg,#3b82f6,#6366f1)}.star-tool:nth-child(3) .tool-icon{background:linear-gradient(135deg,#10b981,#14b8a6)}.star-tool:nth-child(4) .tool-icon{background:linear-gradient(135deg,#f97316,#f59e0b)}.star-tool:nth-child(5) .tool-icon{background:linear-gradient(135deg,#ec4899,#a855f7)}.star-tool:nth-child(6) .tool-icon{background:linear-gradient(135deg,#f59e0b,#eab308)}
  .star-tool b{display:block;font-size:12px}.star-tool small{display:block;margin-top:4px;color:#716b7c;font-size:9px;line-height:1.4}
  .star-feature-card{margin:0 auto 22px;width:min(980px,100%);padding:18px;border:1px solid rgba(168,85,247,.15);border-radius:20px;background:linear-gradient(135deg,rgba(124,60,255,.075),rgba(255,255,255,.018));display:flex;align-items:center;gap:16px;box-shadow:0 16px 40px rgba(0,0,0,.12)}
  .star-feature-card .feature-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:rgba(124,60,255,.16);color:#c6aaff;font-size:20px}.star-feature-card b{font-size:13px}.star-feature-card p{margin:4px 0 0;color:#777182;font-size:11px}.star-feature-card .feature-arrow{margin-left:auto;color:#a96cff;font-size:18px}
  .composer-wrap{padding:14px clamp(12px,5vw,70px) 12px;background:linear-gradient(transparent,rgba(5,5,11,.98) 22%)}
  .dashboard-page #chat{width:min(980px,100%);border-radius:20px;padding:7px;border:1px solid rgba(168,85,247,.18);background:rgba(16,14,27,.94);box-shadow:0 18px 55px rgba(0,0,0,.35),0 0 35px rgba(124,60,255,.07)}
  .dashboard-page #message{font-size:16px;min-height:50px}.attach-button{border-radius:13px;color:#91899e}.dashboard-page #sendButton{width:50px;min-width:50px;height:50px;min-height:50px;border-radius:15px;background:linear-gradient(135deg,#7c3cff,#a34fff);box-shadow:0 10px 25px rgba(124,60,255,.28)}
  .composer-note{font-size:9px;color:#514c5c}
  .image-preview{width:min(980px,100%);border-radius:16px;background:rgba(16,14,27,.94);border-color:rgba(168,85,247,.18)}
  .star-status-message{border-radius:14px!important;background:linear-gradient(90deg,rgba(124,60,255,.1),rgba(124,60,255,.035))!important}
  @media(max-width:1000px){.star-tools{grid-template-columns:repeat(3,minmax(0,1fr))}.star-tool{min-height:92px}}
  @media(max-width:850px){.dashboard-page .dash-nav{height:64px;min-height:64px}.dashboard-shell{height:calc(100vh - 64px);height:calc(100dvh - 64px)}.star-tools{grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:18px}.star-tool{min-height:82px;padding:10px 6px;border-radius:14px}.star-tool .tool-icon{width:31px;height:31px;margin-bottom:6px;font-size:14px}.star-tool b{font-size:10px}.star-tool small{display:none}.star-feature-card{padding:13px;border-radius:16px}.star-feature-card p{font-size:9px}.welcome{margin:3vh auto 2vh}.welcome .welcome-icon{width:58px;height:58px;border-radius:19px;font-size:27px}.welcome h1{font-size:30px}.welcome p{font-size:12px}.dashboard-page #messages{padding:22px 12px 26px}.dashboard-page .msg{font-size:15px}.composer-wrap{padding:8px}.dashboard-page #chat{border-radius:17px}.chat-main-head{padding:0 13px}}
  `;
  document.head.appendChild(style);

  function addTools(){
    const main=document.querySelector('.chat-main');
    const messages=document.getElementById('messages');
    if(!main||!messages||document.querySelector('.star-tools'))return;
    const tools=document.createElement('div');
    tools.className='star-tools';
    const items=[['▣','تعديل الصورة','تحسين وتعديل الصور'],['◉','تحليل الصورة','وصف وفهم المحتوى'],['✎','تحسين النص','صياغة أكثر احترافية'],['◎','ترجمة','ترجمة سريعة ودقيقة'],['▤','تلخيص','اختصر أي نص'],['✦','أفكار','إبداع ومقترحات']];
    items.forEach(item=>{const b=document.createElement('button');b.type='button';b.className='star-tool';b.innerHTML='<span class="tool-icon">'+item[0]+'</span><b>'+item[1]+'</b><small>'+item[2]+'</small>';b.addEventListener('click',()=>{const input=document.getElementById('message');if(!input)return;const prompts={'تعديل الصورة':'عدّل الصورة بشكل احترافي مع الحفاظ على التفاصيل الطبيعية','تحليل الصورة':'حلّل هذه الصورة بالتفصيل واشرح ما يظهر فيها','تحسين النص':'حسّن صياغة النص التالي واجعله أكثر احترافية','ترجمة':'ترجم النص التالي ترجمة دقيقة','تلخيص':'لخّص النص التالي باختصار','أفكار':'أعطني أفكارًا إبداعية ومميزة'};input.value=prompts[item[1]]||'';input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));});tools.appendChild(b);});
    messages.parentNode.insertBefore(tools,messages);
  }

  function addFeature(){
    const composer=document.querySelector('.composer-wrap');
    if(!composer||document.querySelector('.star-feature-card'))return;
    const card=document.createElement('div');card.className='star-feature-card';card.innerHTML='<span class="feature-icon">✦</span><div><b>STAR AI يفهم النص والصور</b><p>ارفع صورة، اكتب طلبك، واترك الباقي للذكاء الاصطناعي.</p></div><span class="feature-arrow">›</span>';
    composer.parentNode.insertBefore(card,composer);
  }

  function enhanceSidebar(){
    const bottom=document.querySelector('.sidebar-bottom');
    if(!bottom||document.querySelector('.star-sidebar-links'))return;
    const box=document.createElement('div');box.className='star-sidebar-links';box.style.cssText='margin:12px 0;padding:12px;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(255,255,255,.018);color:#777182;font-size:10px;line-height:1.8';box.innerHTML='<b style="display:block;color:#bdb5ca;font-size:11px;margin-bottom:3px">STAR AI</b>مساعدك الذكي للكتابة والصور والأفكار';bottom.insertBefore(box,bottom.firstChild);
  }

  function init(){addTools();addFeature();enhanceSidebar();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;
  dashboard = dashboard.replace('</body>', script + '\n</body>', 1);
  fs.writeFileSync(dashboardFile, dashboard);
  console.log('STAR AI premium UI v2 enabled.');
}
`;
  dashboard = dashboard.replace('</body>', script + '\n</body>', 1);
  fs.writeFileSync(dashboardFile, dashboard);
  console.log('STAR AI premium UI v2 enabled.');
}
