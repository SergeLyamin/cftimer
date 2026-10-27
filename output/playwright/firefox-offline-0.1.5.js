async(page)=>{
 const assert=(v,m)=>{if(!v)throw new Error(m)};
 await page.goto('http://127.0.0.1:43873/');
 await page.getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByText('Версия 0.1.5',{exact:true}).waitFor();
 await page.getByText('Готов к запуску без сети',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.context().setOffline(true);
 await page.reload();
 assert(await page.getByRole('region',{name:'Выбор режима'}).count()===1,'Offline home');
 for(const url of ['/favicon.svg','/favicon.ico','/fonts/Oswald-Variable.ttf']) assert(await page.evaluate(async url=>(await fetch(url)).ok,url),'Offline asset '+url);
 await page.getByRole('button',{name:/Интервалы/}).click();await page.getByRole('button',{name:'Старт',exact:true}).click();
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('button',{name:'Редактировать таймер',exact:true}).click();
 assert(await page.locator('#work').inputValue()==='00:12','Offline config not saved');
 await page.getByRole('button',{name:'Старт',exact:true}).click();
 assert(await page.locator('.app').getAttribute('data-status')==='running','Offline start');
 await page.screenshot({path:'output/playwright/accept27-firefox-offline.png'});
 await page.context().setOffline(false);
 return{engine:'firefox',version:'0.1.5',offlineReload:true,offlineAssets:true,offlineEditRestart:true};
}
