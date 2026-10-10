import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

const patch = String.raw`<style data-tr-ai-mobile-scroll-fix="v2">
html,body.dashboard-page{width:100%;min-width:0}
body.dashboard-page{overflow:hidden}
body.dashboard-page .dashboard-shell{min-height:0;min-width:0}
body.dashboard-page .chat-main{min-height:0;min-width:0;overflow:hidden}
body.dashboard-page #messages{display:block;flex:1 1 auto;min-height:0;height:auto;max-height:none;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior-y:auto}
body.dashboard-page .messages-inner{min-height:100%;padding-bottom:16px}
body.dashboard-page .conversation-list{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y}
body.dashboard-page #message{touch-action:pan-y}
@media(max-width:800px){
  html,body.dashboard-page{height:auto;min-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:auto}
  body.dashboard-page{min-height:100dvh;height:auto}
  body.dashboard-page .dashboard-shell{height:auto;min-height:calc(100dvh - 64px);display:flex;overflow:visible}
  body.dashboard-page .chat-main{flex:1 1 auto;width:100%;height:auto;min-height:calc(100dvh - 64px);overflow:visible}
  body.dashboard-page #messages{flex:0 0 auto;height:auto;min-height:55dvh;max-height:none;overflow:visible;touch-action:pan-y;padding-bottom:24px}
  body.dashboard-page .messages-inner{min-height:0}
  body.dashboard-page .composer-wrap{position:sticky;bottom:0;z-index:30;padding-bottom:max(9px,env(safe-area-inset-bottom));background:linear-gradient(transparent,rgba(7,6,14,.98) 20%)}
}
</style>`;
const existingStyle = /<style data-tr-ai-mobile-scroll-fix="v\\d+">[\\s\\S]*?<\\/style>/;
if (existingStyle.test(dashboard)) dashboard = dashboard.replace(existingStyle, patch);
else dashboard = dashboard.replace('</head>', patch + '\\n</head>');
fs.writeFileSync(dashboardFile, dashboard);
console.log('TR AI mobile page scrolling fallback enabled.');
