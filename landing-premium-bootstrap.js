import fs from 'node:fs';

const file = new URL('./index.html', import.meta.url);
let html = fs.readFileSync(file, 'utf8');
let changed = false;
const emblem = '/assets/star-ai-world.svg?v=7';
for (const oldSrc of ['/assets/star-ai-world.svg?v=3','/assets/star-ai-world.svg?v=4','/assets/star-ai-world.svg?v=5','/assets/star-ai-world.svg?v=6','/assets/star-ai-world.svg','/assets/star-ai-emblem.svg?v=2','/assets/star-ai-emblem.jpg?v=1','/assets/star-ai-emblem.jpg?v=2','/assets/star-ai-emblem.jpg?v=3','/assets/star-ai-emblem.jpg?v=4']) {
  if (html.includes(oldSrc)) { html = html.replaceAll(oldSrc, emblem); changed = true; }
}

if (!html.includes('data-star-premium="v6"')) {
  const script = String.raw`<style data-star-premium="v6">
:root{--star-purple:#8b5cf6;--star-blue:#38bdf8;--star-bg:#05050b}
body{background:radial-gradient(circle at 50% 0%,rgba(104,57,220,.17),transparent 34%),radial-gradient(circle at 80% 22%,rgba(56,189,248,.07),transparent 24%),#05050b}
.nav{position:sticky!important;top:0;z-index:50;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:rgba(5,5,11,.72)!important;border-bottom:1px solid rgba(167,139,250,.13)!important}
.brand-logo{object-fit:contain!important;border-radius:50%!important;box-shadow:0 0 0 1px rgba(139,92,246,.35),0 0 24px rgba(99,64,220,.35)!important;transition:transform .35s ease,box-shadow .35s ease}.brand:hover .brand-logo{transform:scale(1.04);box-shadow:0 0 0 1px rgba(56,189,248,.45),0 0 30px rgba(139,92,246,.55)!important}
.hero{position:relative;overflow:hidden}.hero:before,.hero:after{content:"";position:absolute;pointer-events:none;border-radius:50%;filter:blur(2px);opacity:.5}.hero:before{width:360px;height:360px;left:50%;top:40px;transform:translateX(-50%);background:radial-gradient(circle,rgba(124,58,237,.18),transparent 68%)}.hero:after{width:2px;height:2px;left:18%;top:170px;background:#bca7ff;box-shadow:120px 90px 0 #6dd3ff,240px 35px 0 #c4b5fd,390px 130px 0 #8b5cf6,510px 50px 0 #7dd3fc,-60px 210px 0 #a78bfa,600px 250px 0 #c084fc;animation:starFloat 7s ease-in-out infinite alternate}
.hero-brand-logo{object-fit:contain!important;border-radius:0!important;position:relative;z-index:2;box-shadow:none!important;mix-blend-mode:normal!important;filter:drop-shadow(0 0 30px rgba(96,66,220,.3))!important;animation:starReveal .9s ease both,starBreathe 5s ease-in-out 1s infinite}
.pill{position:relative;z-index:3;box-shadow:0 0 24px rgba(139,92,246,.1)}
.hero h1{font-family:Arial Black,Inter,system-ui,sans-serif!important;font-weight:900!important;letter-spacing:-.04em!important;line-height:.99!important;text-wrap:balance!important;transform:scaleX(1.025);transform-origin:center}.hero h1 span{font-family:inherit!important;font-weight:900!important;letter-spacing:-.055em!important;background:linear-gradient(100deg,#b7a2ff 5%,#8b5cf6 45%,#38bdf8 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.btn{transition:transform .25s ease,box-shadow .25s ease,filter .25s ease}.btn:hover{transform:translateY(-2px);filter:brightness(1.08);box-shadow:0 12px 34px rgba(124,58,237,.28)}
.cards>div,.plan,.faq-list details{transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}.cards>div:hover,.plan:hover,.faq-list details:hover{transform:translateY(-4px);border-color:rgba(168,85,247,.38)!important;box-shadow:0 18px 50px rgba(40,15,80,.24)}
.plan.popular{box-shadow:0 0 0 1px rgba(139,92,246,.22),0 18px 55px rgba(76,29,149,.18)!important}.cta{position:relative;overflow:hidden}.cta:after{content:"";position:absolute;inset:auto -10% -70% -10%;height:220px;background:radial-gradient(ellipse,rgba(139,92,246,.2),transparent 68%);pointer-events:none}
@keyframes starReveal{from{opacity:0;transform:scale(.9);filter:blur(8px)}to{opacity:1;transform:scale(1);filter:blur(0)}}@keyframes starBreathe{50%{transform:translateY(-5px) scale(1.012);filter:drop-shadow(0 0 22px rgba(139,92,246,.28))}}@keyframes starFloat{to{transform:translate(10px,12px);opacity:.8}}
@media(max-width:600px){.nav{padding-left:16px!important;padding-right:16px!important}.hero{padding-top:46px!important}.hero-brand-logo{width:110px!important;height:110px!important;margin-bottom:18px!important}.hero h1{font-size:clamp(38px,10.7vw,54px)!important;letter-spacing:-.05em!important;line-height:.99!important;transform:none}.hero h1 span{letter-spacing:-.06em!important}.hero p{max-width:340px!important}.hero-buttons .btn{width:100%}.cards>div:hover,.plan:hover,.faq-list details:hover{transform:none}.hero:after{left:10%;top:160px;box-shadow:90px 100px 0 #6dd3ff,210px 20px 0 #c4b5fd,320px 150px 0 #8b5cf6,-20px 240px 0 #a78bfa}}
@media(prefers-reduced-motion:reduce){*,*:before{animation:none!important;transition:none!important}}
</style>`;
  html = html.replace('</head>', script + '\n</head>');
  changed = true;
}

if (changed) fs.writeFileSync(file, html);
console.log('STAR AI premium landing typography and compact emblem rendering enabled.');
