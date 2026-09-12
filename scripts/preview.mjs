import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { root, productIds, readProduct, languages, layout } from '../src/compiler.mjs';

const destination = resolve(process.argv[2] || join(root, 'dist/preview.html'));
const defaultLocale = process.argv[3] || 'en';
if (!(defaultLocale in languages)) throw new Error('Unknown preview locale');
const messages = JSON.parse(readFileSync(join(root, 'locales/messages.json')));
const ui = JSON.parse(readFileSync(join(root, 'locales/preview.json')));
const products = productIds.map(id => ({ ...readProduct(id), image: `data:image/png;base64,${readFileSync(join(root, 'assets', id, 'sidebar.png')).toString('base64')}` }));
for (const [locale, [language]] of Object.entries(languages)) {
  ui[locale].shortcut = readFileSync(join(root, 'locales', `${language}.nsh`), 'utf8').match(/^LangString createDesktop \S+ "([^"]+)"/m)[1];
}
const data = JSON.stringify({ products, messages, ui, layout, defaultLocale }).replaceAll('<', '\\u003c');
const html = readFileSync(join(root, 'src/preview.html'), 'utf8').replace('__INSTALLER_DATA__', () => data);
mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, html); console.log(destination);
