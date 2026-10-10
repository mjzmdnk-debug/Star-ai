import fs from 'node:fs';

const dashboardFile = new URL('./dashboard.html', import.meta.url);
let dashboard = fs.readFileSync(dashboardFile, 'utf8');

if (!dashboard.includes('data-tr-ai-mobile-scroll-fix="v1"')) {
  const patch = String.raw`<style data-tr-ai-mobile-scroll-fix="v1">
html,body.dashboard-page{width:100%;min-width:0}
body.dashboard-page{overflow:hidden;overscroll-behavior:none}
body.dashboard-page .dashboard-shell{min-height:0;min-width:0}
body.dashboard-page .chat-main{min-height:0;min-width:0;overflow:hidden}
body.dashboard-page #messages{display:block;flex:1 1 0%;min-height:0;height:0;max-height:100%;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior-y:contain;scrollbar-gutter:stable}
body.dashboard-page .messages-inner{min-height:min-content;padding-bottom:12px}
body.dashboard-page .conversation-list{overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior-y:contain}
body.dashboard-page #message{touch-action:pan-y;overscroll-behavior:contain}
@media(max-width:800px){
  body.dashboard-page{height:100vh;height:100dvh}
  body.dashboard-page .dashboard-shell{height:calc(100vh - 70px);height:calc(100dvh - 70px);display:flex;min-height:0;overflow:hidden}
  body.dashboard-page .chat-main{flex:1 1 auto;width:100%;height:100%;min-height:0}
  body.dashboard-page #messages{padding-bottom:max(24px,env(safe-area-inset-bottom));overscroll-behavior-y:auto}
  body.dashboard-page .composer-wrap{padding-bottom:max(9px,env(safe-area-inset-bottom))}
}
</style>`;
  dashboard = dashboard.replace('</head>', patch + '\n</head>');
  fs.writeFileSync(dashboardFile, dashboard);
  console.log('TR AI mobile touch scrolling fix enabled.');
}
