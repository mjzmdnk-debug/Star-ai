import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

const patch = String.raw`<style data-tr-ai-mobile-scroll-fix="v3">
/* One consistent viewport model: the conversation owns scrolling on desktop and mobile. */
html,body.dashboard-page{width:100%;min-width:0;height:100%;min-height:100%;overflow:hidden}
body.dashboard-page{height:100vh;height:100dvh;min-height:0;overscroll-behavior:none}
body.dashboard-page .dash-nav{height:70px;min-height:70px;padding-top:env(safe-area-inset-top,0px)}
body.dashboard-page .dashboard-shell{height:calc(100vh - 70px);height:calc(100dvh - 70px);min-height:0;min-width:0;overflow:hidden}
body.dashboard-page .chat-main{min-height:0;min-width:0;height:100%;overflow:hidden}
body.dashboard-page #messages{display:block;flex:1 1 auto;min-height:0;height:auto;max-height:none;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior-y:contain;scroll-padding-bottom:20px}
body.dashboard-page .messages-inner{min-height:100%;padding-bottom:16px}
body.dashboard-page .conversation-list{overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}
body.dashboard-page #message{touch-action:pan-y;min-width:0}
body.dashboard-page .composer-wrap{padding-bottom:max(10px,env(safe-area-inset-bottom))}
@media(max-width:850px){
  html,body.dashboard-page{height:100%;min-height:100%;overflow:hidden}
  body.dashboard-page{height:100vh;height:100dvh;min-height:0}
  body.dashboard-page .dashboard-shell{display:flex;height:calc(100vh - 70px);height:calc(100dvh - 70px);min-height:0;overflow:hidden}
  body.dashboard-page .chat-main{display:flex;flex:1 1 auto;width:100%;height:100%;min-height:0;overflow:hidden}
  body.dashboard-page #messages{flex:1 1 auto;height:auto;min-height:0;max-height:none;overflow-x:hidden;overflow-y:auto;padding-bottom:20px;overscroll-behavior-y:contain}
  body.dashboard-page .composer-wrap{position:relative;flex:0 0 auto;z-index:30;padding:9px 9px max(9px,env(safe-area-inset-bottom));background:rgba(7,6,14,.98)}
  body.dashboard-page #chat{width:100%;max-width:100%}
  body.dashboard-page #message{max-height:24dvh;min-height:48px}
  body.dashboard-page .chat-sidebar{top:70px}
  body.dashboard-page .mobile-overlay{inset:70px 0 0}
  body.dashboard-page .dash-nav{padding-top:env(safe-area-inset-top,0px)}
  body.dashboard-page .mobile-menu{flex:0 0 auto}
  body.dashboard-page .chat-title-wrap{min-width:0;flex:1}
  body.dashboard-page .chat-title{min-width:0}
  body.dashboard-page .chat-title b,body.dashboard-page .chat-title small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
@media(max-width:390px){
  body.dashboard-page .dash-nav{padding-left:10px;padding-right:10px}
  body.dashboard-page .dash-user{gap:6px}
  body.dashboard-page .brand{font-size:16px}
  body.dashboard-page .chat-main-head{padding-left:10px;padding-right:10px}
  body.dashboard-page #messages{padding-left:10px;padding-right:10px}
  body.dashboard-page .dashboard-page .msg{max-width:94%}
}
</style>`;
const styleStart = dashboard.indexOf('<style data-tr-ai-mobile-scroll-fix="v');
const styleEnd = styleStart >= 0 ? dashboard.indexOf('</style>', styleStart) : -1;
if (styleStart >= 0 && styleEnd >= 0) dashboard = dashboard.slice(0, styleStart) + patch + dashboard.slice(styleEnd + '</style>'.length);
else dashboard = dashboard.replace('</head>', patch + '\n</head>');
fs.writeFileSync(dashboardFile, dashboard);
console.log('TR AI mobile page scrolling fallback enabled.');
