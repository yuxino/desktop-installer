import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { productIds, readProduct } from '../src/compiler.mjs';

const directory = resolve(process.argv[2] || 'dist/windows-ui');
const records = JSON.parse(readFileSync(join(directory, 'results.json'), 'utf8').replace(/^\uFEFF/, ''));
const locales = ['en', 'zh-Hans', 'ja'];
const pages = ['welcome', 'directory', 'finish'];
const captures = {};
for (const product of productIds) {
  for (const locale of locales) {
    const record = records.find(item => item.product === product && item.locale === locale);
    if (record?.status !== 'passed') throw new Error(`Native UI did not pass: ${product}/${locale}`);
    for (const page of pages) {
      const key = `${product}-${locale}-${page}`;
      const image = readFileSync(join(directory, `${key}.png`));
      if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${key}`);
      captures[key] = `data:image/png;base64,${image.toString('base64')}`;
    }
  }
}
const products = productIds.map(id => ({ id, name: readProduct(id).name }));
const data = JSON.stringify({ products, captures, records }).replaceAll('<', '\\u003c');
const workflow = process.env.GITHUB_RUN_ID
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
const html = `<!doctype html>
<html lang="zh-Hans"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Windows 安装界面 · 原生 CI 截图</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#fafafa;color:#242428;font:15px/1.7 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:44px 28px 64px}h1{font-size:30px;line-height:1.2;letter-spacing:-.03em;margin:0 0 16px}p{max-width:900px;color:#616168;margin:8px 0}a{color:inherit}nav{display:flex;gap:24px;flex-wrap:wrap;align-items:center;padding:20px 0;margin:14px 0 24px;border-block:1px solid #ddd}label{display:flex;align-items:center;gap:10px}select{background:white;border:1px solid #bbb;border-radius:5px;padding:7px 30px 7px 10px;color:inherit;font:inherit}#gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px 32px}figure{margin:0;min-width:0}figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}h2{font-size:20px;letter-spacing:-.01em;margin:0}.meta{font-size:12px;color:#777}img{display:block;width:auto;max-width:100%;height:auto;background:white;border:1px solid #ddd}dialog{max-width:95vw;max-height:95vh;border:1px solid #ccc;padding:16px;background:#fafafa}dialog::backdrop{background:#0007}dialog img{max-width:none}dialog button{display:block;margin:0 0 12px auto;background:white;border:1px solid #aaa;padding:6px 16px;border-radius:4px;font:inherit}footer{margin-top:38px;border-top:1px solid #ddd;padding-top:18px;font-size:13px;color:#777}@media(max-width:760px){main{padding:28px 16px}#gallery{grid-template-columns:1fr}h1{font-size:26px}nav{gap:14px}}
</style>
<main><h1>Windows 安装界面</h1>
<p>以下均来自 Windows CI 中实际运行的 NSIS 窗口。六个项目、三种语言，已检查前进、返回、完成和运行复选框。</p>
<p>这些程序使用项目实际安装主题，安装内容为空；截图验证界面与操作，不代替真实应用的安装、升级、权限和多显示器测试。</p>
<nav><label>语言 <select id="locale"><option value="zh-Hans">简体中文</option><option value="en">English</option><option value="ja">日本語</option></select></label><label>页面 <select id="page"><option value="finish">安装完成</option><option value="welcome">欢迎安装</option><option value="directory">安装位置</option></select></label>${workflow ? `<a href="${workflow}" target="_blank" rel="noreferrer">查看 CI 记录</a>` : ''}</nav>
<div id="gallery"></div><footer>保留 PNG 原始像素；点击图片查看原始尺寸。下载进度、安装和重新启动属于各应用的更新功能。</footer></main><dialog id="zoom"><button id="close-zoom" type="button">关闭</button><img id="zoom-image" alt=""></dialog>
<script type="application/json" id="data">${data}</script>
<script>
const data=JSON.parse(document.getElementById('data').textContent);
const locale=document.getElementById('locale'),page=document.getElementById('page'),gallery=document.getElementById('gallery');
const zoom=document.getElementById('zoom'),zoomImage=document.getElementById('zoom-image');document.getElementById('close-zoom').addEventListener('click',()=>zoom.close());
const query=new URLSearchParams(location.search);
if(['en','zh-Hans','ja'].includes(query.get('locale')))locale.value=query.get('locale');
if(['welcome','directory','finish'].includes(query.get('page')))page.value=query.get('page');
function render(){gallery.replaceChildren();for(const product of data.products){const figure=document.createElement('figure'),caption=document.createElement('figcaption'),heading=document.createElement('h2'),meta=document.createElement('span'),link=document.createElement('a'),image=document.createElement('img');heading.textContent=product.name;meta.className='meta';meta.textContent=locale.selectedOptions[0].textContent+' · '+data.records.find(r=>r.product===product.id&&r.locale===locale.value).dpi+' DPI';image.src=data.captures[product.id+'-'+locale.value+'-'+page.value];image.alt=product.name+' '+locale.selectedOptions[0].textContent+' '+page.selectedOptions[0].textContent+' Windows 原生截图';link.href='#zoom';link.addEventListener('click',event=>{event.preventDefault();zoomImage.src=image.src;zoomImage.alt=image.alt;zoom.showModal()});link.append(image);caption.append(heading,meta);figure.append(caption,link);gallery.append(figure)}}locale.addEventListener('change',render);page.addEventListener('change',render);render();
</script></html>`;
writeFileSync(join(directory, 'index.html'), html);
console.log(`Native screenshot gallery: ${records.length} cases, ${Object.keys(captures).length} screenshots`);
