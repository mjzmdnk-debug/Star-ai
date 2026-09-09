import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('data-star-status-indicator="v1"')) {
  const script = String.raw`<script data-star-status-indicator="v1">
(() => {
  const messages = () => document.getElementById('messagesInner');
  let active = null;
  function hideStatus(){if(active&&active.isConnected)active.remove();active=null}
  function showStatus(kind,label){hideStatus();const root=messages();if(!root)return;const box=document.createElement('div');box.className='msg ai star-status-message';box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.dataset.kind=kind;box.innerHTML='<span class="star-status-dot"></span><span class="star-status-label"></span><span class="star-status-pulse"><i></i><i></i><i></i></span>';box.querySelector('.star-status-label').textContent=label;root.appendChild(box);active=box;const scroller=document.getElementById('messages');if(scroller)scroller.scrollTop=scroller.scrollHeight}
  function requestKind(url){const value=String(url||'');if(value.includes('/api/image-edit'))return['edit','✦ Görsel düzenleniyor'];if(value.includes('/api/image-analyze'))return['analyze','◉ Görsel analiz ediliyor'];if(value.includes('/api/chat'))return['think','✦ Düşünüyor ve yazıyor'];return null}
  const originalFetch=window.fetch;window.fetch=async function(input,init){const url=typeof input==='string'?input:(input&&input.url)||'';const kind=requestKind(url);if(kind)showStatus(kind[0],kind[1]);try{const response=await originalFetch.apply(this,arguments);if(kind)hideStatus();return response}catch(error){if(kind)hideStatus();throw error}};
  const style=document.createElement('style');style.textContent='.star-status-message{display:inline-flex!important;align-items:center;gap:9px;padding:11px 14px!important;margin-bottom:16px!important;color:#cfc7df!important;background:rgba(124,60,255,.075)!important;border-color:rgba(168,85,247,.22)!important;font-size:13px!important;min-height:22px!important;box-shadow:0 8px 28px rgba(0,0,0,.12)}.star-status-dot{width:7px;height:7px;border-radius:50%;background:#a96cff;box-shadow:0 0 12px rgba(169,108,255,.9);animation:starStatusGlow 1s infinite ease-in-out}.star-status-label{font-weight:700;white-space:nowrap}.star-status-pulse{display:inline-flex;gap:3px;align-items:center}.star-status-pulse i{display:block;width:4px;height:4px;border-radius:50%;background:#c9b5ff;animation:starStatusPulse 1s infinite ease-in-out}.star-status-pulse i:nth-child(2){animation-delay:.16s}.star-status-pulse i:nth-child(3){animation-delay:.32s}@keyframes starStatusGlow{50%{opacity:.35;transform:scale(.7)}}@keyframes starStatusPulse{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}';document.head.appendChild(style);
})();
</script>`;
  dashboard=dashboard.replace('</body>',script+'\n</body>',1);fs.writeFileSync(dashboardFile,dashboard);console.log('STAR AI live status indicator enabled.');
}

await import('./ui-design-bootstrap.js');
await import('./asset-serving-bootstrap.js');
await import('./chat-pro-bootstrap.js');
await import('./image-support-bootstrap.js');
await import('./image-analysis-bootstrap.js');
await import('./mobile-auth-bootstrap.js');
await import('./landing-premium-bootstrap.js');
await import('./turkish-icons-bootstrap.js');
await import('./professional-ai-engine-bootstrap.js');
await import('./live-research-bootstrap.js');
await import('./language-selector-bootstrap.js');
