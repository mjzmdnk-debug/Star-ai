import fs from 'node:fs';

const loginFile = new URL('./login.html', import.meta.url);
let html = fs.readFileSync(loginFile, 'utf8');
const patch = String.raw`<style data-tr-ai-auth-scroll-fix="v1">
html{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch}
html:has(body.auth-page){height:auto!important;min-height:100%!important;overflow-y:auto!important}
body.auth-page{height:auto!important;min-height:100dvh!important;max-height:none!important;overflow-x:hidden!important;overflow-y:visible!important;position:relative}
body.auth-page .auth-shell{height:auto!important;min-height:100dvh!important;max-height:none!important;overflow:visible!important;align-content:start}
body.auth-page .auth-visual,body.auth-page .auth-panel{min-width:0}
@media(max-width:850px){
  html:has(body.auth-page),body.auth-page{height:auto!important;min-height:100%!important;overflow-y:auto!important;overscroll-behavior-y:auto!important}
  body.auth-page .auth-shell{display:flex!important;flex-direction:column!important;height:auto!important;min-height:100dvh!important;padding:12px!important;overflow:visible!important}
  body.auth-page .auth-visual{flex:0 0 auto!important;min-height:270px!important;height:auto!important;overflow:hidden!important}
  body.auth-page .auth-panel{flex:0 0 auto!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:28px 18px 36px!important}
  body.auth-page .auth-card{width:100%!important;max-width:410px!important}
}
</style>`;
const marker = '<style data-tr-ai-auth-scroll-fix="v';
const start = html.indexOf(marker);
const end = start >= 0 ? html.indexOf('</style>', start) : -1;
if (start >= 0 && end >= 0) html = html.slice(0, start) + patch + html.slice(end + 8);
else html = html.replace('</head>', patch + '\n</head>');
fs.writeFileSync(loginFile, html);
console.log('TR AI mobile login page scrolling fix enabled.');
