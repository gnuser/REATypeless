'use strict';
const {spawn}=require('node:child_process');
class TargetClient {
 constructor(executable){this.executable=executable;this.pending=new Map();this.serial=0;this.child=null;}
 start(){if(this.child)return;const child=spawn(this.executable,['serve',String(process.pid)],{stdio:['pipe','pipe','ignore']});this.child=child;let buffer='';child.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const reply=JSON.parse(line),entry=this.pending.get(reply.id);if(entry){clearTimeout(entry.timer);this.pending.delete(reply.id);entry.resolve(reply);}}catch{}}});const failed=()=>{if(this.child===child)this.child=null;for(const [id,entry] of this.pending){clearTimeout(entry.timer);entry.reject(Error('Input helper stopped. Please retry.'));this.pending.delete(id);}};child.on('error',failed);child.on('exit',failed);child.stdin.on('error',failed);}
 request(op,args={}){this.start();const id=++this.serial;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Input helper timed out.'));},5000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,op,...args})+'\n');});}
 close(){this.child?.stdin.end();this.child?.kill();}
}
module.exports={TargetClient};
