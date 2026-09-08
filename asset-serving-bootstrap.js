import fs from 'node:fs';

const serverFile = new URL('./server.js', import.meta.url);
let server = fs.readFileSync(serverFile, 'utf8');

const marker = "app.use('/assets', express.static";
if (!server.includes(marker)) {
  const route = "app.use('/assets', express.static(new URL('./assets', import.meta.url).pathname, { dotfiles: 'deny', index: false, maxAge: '7d' }));\n";
  const anchor = "const app = express();\n";
  if (server.includes(anchor)) {
    server = server.replace(anchor, anchor + route);
    fs.writeFileSync(serverFile, server);
    console.log('STAR AI asset serving enabled.');
  } else {
    throw new Error('Unable to install asset serving route.');
  }
}
