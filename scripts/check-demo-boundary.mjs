import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const files=(await readdir('dist/assets')).filter(f=>f.endsWith('.js'));
const bundle=(await Promise.all(files.map(f=>readFile('dist/assets/'+f,'utf8')))).join('\n');
for(const marker of ['AstraDemo!2026','manager1@astra.demo','univ1@astra.demo','demo-quick-login__accounts','astra.demo.login.v1','astra.demo.profiles.v1','astra.demo.member-status.v1','astra.demo.workspace.v1','DEMO-PAY-','a4cbbc71d9fcb3908938e1335a61fc6cd5706207'])
 assert(!bundle.includes(marker),'DEMO fixture leaked into production bundle: '+marker);
console.log('PASS: production bundle excludes DEMO passwords, auth sessions, database, payment implementation and catalog snapshot');
