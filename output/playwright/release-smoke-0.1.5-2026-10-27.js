async(page)=>{
 const assert=(v,m)=>{if(!v)throw new Error(m)};
 const oldAsset=await page.locator('script[type=module][src]').getAttribute('src');assert(oldAsset.includes('index-BgKQaoxn'),'old asset');
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update()});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{timeout:30000});
 assert(await page.locator('.app').getAttribute('data-status')==='running','old timer stopped');
 assert(await page.locator('script[type=module][src]').getAttribute('src')===oldAsset,'old timer reloaded');
 await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await page.screenshot({path:'output/playwright/live015-update-waiting.png'});
 const context=await page.context().browser().newContext({viewport:{width:390,height:844}});const fresh=await context.newPage();const errors=[];fresh.on('pageerror',e=>errors.push(e.message));
 let result;
 try{
  await fresh.clock.install();await fresh.goto('https://timer.lyamin.org/');
  const newAsset=await fresh.locator('script[type=module][src]').getAttribute('src');assert(newAsset.includes('index-CETD-MmP'),'fresh asset');
  await fresh.getByRole('button',{name:'Настройки',exact:true}).click();await fresh.getByText('Версия 0.1.5',{exact:true}).waitFor();await fresh.getByText('Готов к запуску без сети',{exact:true}).waitFor({timeout:25000});await fresh.keyboard.press('Escape');
  await fresh.getByRole('button',{name:/Интервалы/}).click();await fresh.getByLabel('Раунды',{exact:true}).fill('2');await fresh.getByLabel('Работа',{exact:true}).fill('0012');await fresh.getByLabel('Отдых',{exact:true}).fill('0003');
  await fresh.locator('.preparation-options summary').click();await fresh.getByLabel('Подготовка',{exact:true}).fill('0001');await fresh.getByRole('button',{name:'Старт',exact:true}).click();
  await fresh.getByRole('button',{name:'Пауза',exact:true}).click();await fresh.waitForTimeout(350);
  const main=await fresh.getByRole('button',{name:'Продолжить',exact:true}).boundingBox();const reset=await fresh.getByRole('button',{name:'Сброс',exact:true}).boundingBox();const edit=await fresh.getByRole('button',{name:'Редактировать таймер',exact:true}).boundingBox();
  assert(main.height===56&&reset.height===40&&edit.height===40,'live control sizes');assert((await fresh.locator('.workout-timeline').boundingBox()).height===3,'live timeline');assert(await fresh.locator('.time-separator').innerText()==='','colon');
  await fresh.mouse.move(0,0);await fresh.screenshot({path:'output/playwright/live015-paused-phone.png'});
  await fresh.getByRole('button',{name:'Редактировать таймер',exact:true}).click();assert(await fresh.getByLabel('Работа',{exact:true}).inputValue()==='00:12','edit kept params');
  await fresh.getByLabel('Работа',{exact:true}).fill('0001');await fresh.getByLabel('Отдых',{exact:true}).fill('0000');await fresh.locator('.preparation-options summary').click();await fresh.getByLabel('Подготовка',{exact:true}).fill('0000');await fresh.getByRole('button',{name:'Старт',exact:true}).click();
  await fresh.clock.runFor(9000);assert(await fresh.locator('.phase').innerText()==='ТЫ МОЛОДЕЦ! 🏆','live completion');assert(await fresh.locator('.workout-progress,.workout-timeline').count()===0,'live completed tracks');
  const paper=await fresh.locator('.completion-confetti').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let total=0,bottom=0;for(let i=3;i<d.length;i+=4)if(d[i]){total++;if(Math.floor(i/4/c.width)>c.height-60*(c.height/innerHeight))bottom++}return{total,bottom}});assert(paper.total>100&&paper.total===paper.bottom,'live confetti settled');
  await fresh.screenshot({path:'output/playwright/live015-completed-phone.png'});
  await fresh.getByRole('button',{name:'Настройки',exact:true}).click();const pulse=fresh.getByRole('switch',{name:'Пульсация краёв',exact:true});await pulse.uncheck();await pulse.check();assert(await fresh.locator('.effect-preview').count()===1,'live pulse demo');await fresh.keyboard.press('Escape');assert(await fresh.locator('.effect-preview').count()===0,'live demo close');
  await context.setOffline(true);await fresh.reload();assert(await fresh.getByRole('region',{name:'Выбор режима'}).count()===1,'live offline home');for(const url of ['/favicon.svg','/favicon.ico','/fonts/Oswald-Variable.ttf'])assert(await fresh.evaluate(async url=>(await fetch(url)).ok,url),'live offline '+url);
  await fresh.getByRole('button',{name:/Интервалы/}).click();assert(await fresh.getByLabel('Работа',{exact:true}).inputValue()==='00:01','offline saved params');await fresh.getByRole('button',{name:'Старт',exact:true}).click();await fresh.getByRole('button',{name:'Пауза / продолжение: время',exact:true}).click();assert(await fresh.locator('.app').getAttribute('data-status')==='paused','live offline pause');await fresh.screenshot({path:'output/playwright/live015-offline-phone.png'});
  assert(errors.length===0,JSON.stringify(errors));result={oldAsset,newAsset,version:'0.1.5',controls:{main:main.height,side:reset.height},paper,offline:true,javascriptErrors:errors};
 }finally{await context.setOffline(false);await context.close()}
 await page.bringToFront();await page.getByRole('button',{name:'Все режимы',exact:true}).click();await page.getByRole('button',{name:'В меню',exact:true}).click();await page.goto('about:blank');await page.waitForTimeout(1000);await page.goto('https://timer.lyamin.org/');assert((await page.locator('script[type=module][src]').getAttribute('src')).includes('index-CETD-MmP'),'old PWA upgrade');await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByText('Версия 0.1.5',{exact:true}).waitFor();await page.screenshot({path:'output/playwright/live015-upgraded-pwa.png'});
 return{...result,update:'old active remained running while waiting; new version after leaving client'};
}
