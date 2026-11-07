import { chromium } from '@playwright/test';
import { readFile, readdir, writeFile } from 'node:fs/promises';
const roots=(await readdir('artifacts/g032-smoke')).sort();
const root=`artifacts/g032-smoke/${process.argv[2]||roots.at(-1)}`;
const files=(await readdir(root)).filter(f=>f.endsWith('-desktop.png')).sort();
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 for(let group=0;group<Math.ceil(files.length/10);group++){
  const items=[];
  for(const file of files.slice(group*10,group*10+10))items.push(`<figure><figcaption>${file.replace('-desktop.png','')}</figcaption><img src="data:image/png;base64,${(await readFile(`${root}/${file}`)).toString('base64')}"></figure>`);
  await page.setContent(`<html><head><style>body{margin:0;padding:20px;background:#e8eef4;font-family:sans-serif}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0;background:white;border-radius:10px;overflow:hidden}figcaption{padding:10px 20px;font-size:16px;color:#23445b}img{width:100%;display:block}</style></head><body><main>${items.join('')}</main></body></html>`);
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  await page.screenshot({path:`${root}/contact-${group+1}.png`,fullPage:true});
 }
 console.log(root);
}finally{await browser.close();}
