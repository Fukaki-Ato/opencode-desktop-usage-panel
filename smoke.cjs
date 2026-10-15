const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const directory = path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'desktop-usage-smoke')
fs.mkdirSync(directory, { recursive: true })
app.setPath('userData', path.join(directory, 'profile'))

app.whenReady().then(async () => {
  const source = fs.readFileSync(path.join(__dirname, 'renderer.cjs'), 'utf8')
  const html = `<html><head><meta charset="utf-8"></head><body style="background:#171717;color:#ddd;font-family:Segoe UI,sans-serif;margin:0"><header style="height:44px;border-bottom:1px solid #333;display:flex;align-items:center;padding:0 12px"><span style="margin-right:auto">OpenCode / Token usage test</span><div id="summary"></div></header><main style="display:flex;height:740px"><div style="flex:1;padding:24px;color:#888">Conversation area</div><aside id="panel" style="width:380px;border-left:1px solid #333"></aside></main><script>const module={exports:{}};${source}\nconst effects=[];const entries=[];let opened=false;const info={tokens:{input:1000,output:200,reasoning:100,cache:{read:9000,write:50}},cost:0.1234};const messages=[{id:'m1',type:'assistant',model:{id:'test-model'},tokens:info.tokens,cost:0.1234}];const session={id:'test',server:{data:{session:{get:()=>info,message:{list:()=>messages}}}}};const api={Slot:{id:'slot'},Panel:{id:'panel'},createEffect:fn=>{effects.push(fn);fn()}};const setup=module.exports(api);const ctx={id:'oc-desktop-usage-panel-v1',add:(kind,value)=>entries.push({kind,value}),layout:{state:()=>opened?'visible':'closed',toggle:()=>{opened=!opened;effects.forEach(fn=>fn())}}};setup(ctx);const style=document.createElement('style');style.textContent=entries.find(e=>e.kind.id==='style').value;document.head.append(style);document.querySelector('#summary').append(entries.find(e=>e.kind.id==='slot').value.render({session}));document.querySelector('#panel').append(entries.find(e=>e.kind.id==='panel').value.render({session}));window.testUsage=()=>{const button=document.querySelector('button');if(!button.textContent.includes('90.0%'))throw Error('Initial hit rate');button.click();if(button.getAttribute('aria-expanded')!=='true')throw Error('Expand state');info.tokens={input:100,output:10,reasoning:5,cache:{read:100,write:0}};effects.forEach(fn=>fn());if(!button.textContent.includes('50.0%'))throw Error('Session update');info.tokens={input:1000,output:200,reasoning:100,cache:{read:9000,write:50}};effects.forEach(fn=>fn());if(document.querySelector('section').scrollWidth>380)throw Error('Panel overflow');return {summary:button.textContent,expanded:button.getAttribute('aria-expanded'),panel:!!document.querySelector('[data-desktop-usage=panel]'),metrics:document.querySelectorAll('dd').length}};</script></body></html>`
  const file = path.join(directory, 'fixture.html')
  fs.writeFileSync(file, html)
  const win = new BrowserWindow({ width: 1100, height: 850, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  await win.loadFile(file)
  const result = await win.webContents.executeJavaScript('window.testUsage()')
  const image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(directory, 'panel.png'), image.toPNG())
  fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(result))
  console.log(JSON.stringify(result))
  win.destroy()
  app.quit()
}).catch(error => { console.error(error); app.exit(1) })
