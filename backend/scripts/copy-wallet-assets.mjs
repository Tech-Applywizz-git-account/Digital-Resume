import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function copyDir(src, dest) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
        const from = path.join(src, entry);
        const to = path.join(dest, entry);
        if (statSync(from).isDirectory()) {
            copyDir(from, to);
        } else {
            copyFileSync(from, to);
        }
    }
}

copyDir(
    path.join(root, 'src/services/wallet/providers/neatpass/templates'),
    path.join(root, 'dist/services/wallet/providers/neatpass/templates'),
);

copyFileSync(
    path.join(root, 'src/services/wallet/walletCard.template.html'),
    path.join(root, 'dist/services/wallet/walletCard.template.html'),
);

console.log('Copied wallet card templates into dist/');
