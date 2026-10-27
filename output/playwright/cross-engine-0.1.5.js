async (page) => {
 const assert=(ok,m)=>{if(!ok)throw new Error(m)};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const engine=page.context().browser().browserType().name();
 await page.goto('http://127.0.0.1:43873/');
 await page.getByRole('button',{name:'Настройки',exact:true}).click();
 await page.getByText('Готов к запуску без сети',{exact:true}).waitFor({timeout:30000});
 await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 const results=[];
 for(const [width,height] of [[1280,800],[390,844],[844,390]]) {
  await page.setViewportSize({width,height});
  for(const mode of ['Интервалы','На время','AMRAP','Tabata','EMOM']) {
   await page.goto('http://127.0.0.1:43873/');
   await page.getByRole('button',{name:new RegExp(mode)}).click();
   if(mode==='Интервалы') {
    const work=page.getByLabel('Работа',{exact:true});await work.focus();await work.press('ControlOrMeta+A');
    await work.pressSequentially('0061');await work.pressSequentially('5');assert(await work.inputValue()==='00:61','bounded input');
    await work.fill('0012');await page.getByLabel('Раунды',{exact:true}).fill('3');await page.getByLabel('Отдых',{exact:true}).fill('0004');
   }
   await page.getByRole('button',{name:'Старт',exact:true}).click();
   await page.getByRole('button',{name:'Пауза',exact:true}).click();
   const main=await page.getByRole('button',{name:'Продолжить',exact:true}).boundingBox();
   const reset=await page.getByRole('button',{name:'Сброс',exact:true}).boundingBox();
   const edit=await page.getByRole('button',{name:'Редактировать таймер',exact:true}).boundingBox();
   assert(main.height===56&&reset.height===40&&edit.height===40,'sizes '+mode);
   assert(Math.abs(reset.x-main.x-main.width-28)<.1,'right gap');
   assert(Math.abs(main.x-edit.x-edit.width-28)<.1,'left gap');
   assert(edit.x>=0&&reset.x+reset.width<=width,'buttons clipped');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
   assert(await page.locator('.time-separator').innerText()==='','visible colon');
   const timeline=page.locator('.workout-timeline');
   if(await timeline.count()) {
    assert((await timeline.boundingBox()).height===3,'timeline height');
    const first=await page.locator('.timeline-segment').first().boundingBox();const last=await page.locator('.timeline-segment').last().boundingBox();assert(first.x>last.x,'countdown order');
    const footer=await page.locator('.timer-footer').boundingBox();assert((await timeline.boundingBox()).y+3<footer.y,'timeline under footer');
   }
   await page.getByRole('button',{name:'Редактировать таймер',exact:true}).click();
   assert(await page.locator('.setup').count()===1,'edit setup');
   await page.getByRole('button',{name:'Старт',exact:true}).click();
   assert(await page.locator('.phase').innerText()==='ПОДГОТОВКА','edit restart');
   await page.getByRole('button',{name:'Пауза / продолжение: время',exact:true}).click();
   assert(await page.locator('.app').getAttribute('data-status')==='paused','readout pause');
   await page.mouse.move(0,0);
   await page.screenshot({path:`output/playwright/accept27-${engine}-${mode==='На время'?'for-time':mode==='Интервалы'?'intervals':mode.toLowerCase()}-${width}.png`});
   results.push({mode,width,height,main:main.height,side:reset.height});
  }
 }
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:43873/');
 await page.getByRole('button',{name:/AMRAP/}).click();await page.getByLabel('Длительность',{exact:true}).fill('0001');
 await page.locator('.preparation-options summary').click();await page.getByLabel('Подготовка',{exact:true}).fill('0000');
 await page.getByRole('button',{name:'Старт',exact:true}).click();
 await page.getByText('ТЫ МОЛОДЕЦ! 🏆',{exact:true}).waitFor();
 await page.waitForTimeout(6200);
 assert(await page.locator('.workout-progress,.workout-timeline').count()===0,'completed tracks');
 const paper=await page.locator('.completion-confetti').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,low=0;for(let i=3;i<d.length;i+=4)if(d[i]){n++;if(Math.floor(i/4/c.width)>c.height-60*(c.height/innerHeight))low++}return{n,low}});
 assert(paper.n>100&&paper.n===paper.low,'paper not settled');
 await page.screenshot({path:`output/playwright/accept27-${engine}-completed-phone.png`});
 await page.getByRole('button',{name:'Настройки',exact:true}).click();
 const pulse=page.getByRole('switch',{name:'Пульсация краёв',exact:true});await pulse.uncheck();await pulse.check();
 assert(await page.locator('.phase-edge-glow.effect-preview').count()===1,'pulse demo');
 const conf=page.getByRole('switch',{name:'Конфетти в конце',exact:true});await conf.uncheck();await conf.check();
 assert(await page.locator('.confetti-preview').count()===1,'confetti demo');
 await page.waitForTimeout(1000);await page.screenshot({path:`output/playwright/accept27-${engine}-settings-phone.png`});
 await page.keyboard.press('Escape');assert(await page.locator('.effect-preview').count()===0,'close demo');
 assert(errors.length===0,JSON.stringify(errors));
 return{engine,version:page.context().browser().version(),results,paper,javascriptErrors:errors};
}
