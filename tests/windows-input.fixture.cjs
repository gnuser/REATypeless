// Interactive Windows regression fixture; see TESTING.txt.
const {app,BrowserWindow,ipcMain,clipboard,globalShortcut}=require('electron');
const path=require('node:path'),fs=require('node:fs');
const {spawn}=require('node:child_process');
const isTarget=process.argv.includes('--target');
app.commandLine.appendSwitch('force-renderer-accessibility');
app.setPath('userData',path.resolve(isTarget?'.tools/input-target-data':'.tools/input-controls-data'));
let helper,child,window,token='';
app.whenReady().then(()=>{
 window=new BrowserWindow({width:650,height:430,title:isTarget?'REATypeless Input Test target':'REATypeless Input Test controls',webPreferences:{nodeIntegration:true,contextIsolation:false}});
 window.webContents.once('did-finish-load',()=>{window.show();window.focus()});
 if(isTarget){window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<title>REATypeless Input Test target</title><h2>Disposable input test</h2><label>Text <textarea id="text" rows="5" cols="55">alpha omega</textarea></label><p><label>Password <input type="password" id="secret"></label></p><script>document.getElementById("text").focus();document.getElementById("text").setSelectionRange(6,6)</script>'));return;}
 helper=new (require('../src/target-client').TargetClient)(path.resolve(process.env.REA_HELPER||'native/windows.ps1'));helper.start();
 ipcMain.handle('capture',async()=>{const r=await helper.request('capture',{ask:true});token=r.token||'';return r;});
 ipcMain.handle('paste',async()=>{clipboard.writeText('你好');return helper.request('paste',{token});});
 window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<title>REATypeless Input Test controls</title><h2>Windows insertion regression test</h2><button onclick="run(\'capture\')">Capture</button> <button onclick="run(\'paste\')">Paste</button><pre id="result">Ready</pre><script>const {ipcRenderer}=require("electron");async function run(op){document.getElementById("result").textContent=JSON.stringify(await ipcRenderer.invoke(op))}ipcRenderer.on("result",(_,r)=>document.getElementById("result").textContent=JSON.stringify(r))</script>'));
 globalShortcut.register('Control+Alt+F9',async()=>{const r=await helper.request('capture',{ask:true});token=r.token||'';window.webContents.send('result',r);});
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 child=spawn(process.execPath,[__filename,'--target'],{env,windowsHide:true,stdio:'ignore'});
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{helper?.close();child?.kill();globalShortcut.unregisterAll();});
