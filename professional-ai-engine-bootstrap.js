import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
const dashboardFile = new URL('./dashboard.html', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('STAR_AI_PRO_ENGINE_V3')) {
  server = server.replace('// STAR_AI_PRO_ENGINE_V2', '// STAR_AI_PRO_ENGINE_V2\n// STAR_AI_PRO_ENGINE_V3');
  server = server.replace("max_output_tokens: maxTokens", "max_output_tokens: Math.min(Math.max(Number(maxTokens) || 1800, 256), 4000)");
  fs.writeFileSync(serverFile, server);
  console.log('STAR AI professional response engine v3 enabled.');
}

let dashboard = fs.readFileSync(dashboardFile, 'utf8');
if (!dashboard.includes('STAR_AI_PRO_UI_V3')) {
  dashboard = dashboard.replace('</body>', '<script data-star-pro-ui="STAR_AI_PRO_UI_V3">window.__starAiProfessionalUIV3=true;</script>\n</body>', 1);
  fs.writeFileSync(dashboardFile, dashboard);
  console.log('STAR AI professional response UI v3 enabled.');
}
