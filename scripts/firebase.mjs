// Roda a versão fixa do firebase-tools com os argumentos recebidos.
// O terminal do VS Code define VSCODE_CWD; com ela, o firebase-tools se acha dentro
// da própria extensão e procura seus arquivos no lugar errado. Por isso ela sai daqui.
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
delete env.VSCODE_CWD;
const r = spawnSync('npx', ['--yes', 'firebase-tools@13.29.1', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: true });
process.exit(r.status ?? 1);
