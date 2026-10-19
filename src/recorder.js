let active=null, pending=null, currentPhase='idle', recordingStarted=0;
setInterval(()=>{document.getElementById('elapsed').textContent=currentPhase==='recording'?Math.floor((Date.now()-recordingStarted)/60000)+':'+String(Math.floor((Date.now()-recordingStarted)/1000)%60).padStart(2,'0'):'';},250);
window.rea.onStatus(({phase,message,uiLanguage})=>{if(phase==='recording'&&currentPhase!=='recording')recordingStarted=Date.now();currentPhase=phase;document.body.className=phase;document.getElementById('message').textContent=messages.translate(message,uiLanguage);});
window.rea.onCapture(async command=>{
 if(command.action==='cancel'){if(pending===command.id)pending=null;if(active?.id===command.id){active.cancelled=true;if(active.recorder.state!=='inactive')active.recorder.stop();active.stream.getTracks().forEach(t=>t.stop());active=null;}return;}
 if(command.action==='stop'){if(active?.id===command.id&&active.recorder.state==='recording')active.recorder.stop();return;}
 if(command.action!=='start'||active)return;
 const id=command.id;pending=id;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:command.microphone&&command.microphone!=='default'?{deviceId:{exact:command.microphone},echoCancellation:true}:true});
  if(pending!==id){stream.getTracks().forEach(t=>t.stop());return;}pending=null;
  const current={id,stream,recorder:new MediaRecorder(stream,{mimeType:'audio/webm;codecs=opus'}),chunks:[],start:Date.now(),cancelled:false};active=current;
  current.recorder.ondataavailable=e=>{if(e.data.size)current.chunks.push(e.data);};
  current.recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());if(active===current)active=null;if(current.cancelled)return;const bytes=new Uint8Array(await new Blob(current.chunks,{type:'audio/webm'}).arrayBuffer());window.rea.audio(id,bytes,(Date.now()-current.start)/1000);};
  current.recorder.onerror=e=>{stream.getTracks().forEach(t=>t.stop());active=null;window.rea.captureError(id,e.error?.message||'Microphone recording failed.');};
  current.recorder.start(500);window.rea.started(id);
 }catch(e){window.rea.captureError(id,e.message);}
});
