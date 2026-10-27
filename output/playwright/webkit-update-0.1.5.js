async(page)=>{
 const assert=(v,m)=>{if(!v)throw new Error(m)};
 await page.goto('http://127.0.0.1:43873/');
 const oldScript=await page.locator('script[type=module][src]').getAttribute('src');
 await page.getByRole('button',{name:/AMRAP/}).click();await page.getByLabel('Длительность',{exact:true}).fill('0100');
 await page.getByRole('button',{name:'Старт',exact:true}).click();await page.getByRole('button',{name:'Пауза',exact:true}).click();
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 assert(await page.locator('.app').getAttribute('data-status')==='paused','Update reset old workout');
 await page.screenshot({path:'output/playwright/accept27-webkit-update-waiting.png'});
 await page.goto('about:blank');await page.waitForTimeout(300);
 await page.goto('http://127.0.0.1:43873/');
 const newScript=await page.locator('script[type=module][src]').getAttribute('src');
 assert(oldScript!==newScript,'New bundle not activated');
 await page.getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByText('Версия 0.1.5',{exact:true}).waitFor();
 await page.getByText('Готов к запуску без сети',{exact:true}).waitFor();
 await page.screenshot({path:'output/playwright/accept27-webkit-upgraded.png'});
 await page.keyboard.press('Escape');
 return{oldScript,newScript,oldPausedPreserved:true,version:'0.1.5',offlineReady:true};
}
