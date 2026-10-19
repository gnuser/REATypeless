(function(root){
 function accelerator(event){
  if(event.repeat||event.isComposing)return null;
  const code=event.code||'';
  if(/^(Meta|Control|Alt|Shift)(Left|Right)$/.test(code))return null;
  if(code==='Escape')return null;
  const named={Space:'Space',Enter:'Return',Backspace:'Backspace',Delete:'Delete',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Home:'Home',End:'End',PageUp:'PageUp',PageDown:'PageDown',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backquote:'`'};
  const key=/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit[0-9]$/.test(code)?code.slice(5):/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)?code:named[code];
  if(!key)return null;
  if(!event.metaKey&&!event.ctrlKey&&!event.altKey&&!/^F\d+$/.test(key))return null;
  return [event.metaKey&&'Command',event.ctrlKey&&'Control',event.altKey&&'Alt',event.shiftKey&&'Shift',key].filter(Boolean).join('+');
 }
 function label(value){return value.split('+').map(k=>({Command:'⌘',Control:'⌃',Alt:'⌥',Shift:'⇧',Space:'Space',Return:'↩',Backspace:'⌫',Delete:'⌦',Up:'↑',Down:'↓',Left:'←',Right:'→'}[k]||k)).join(' ');}
 function validate(values){const keys=['shortcut','translateShortcut','askShortcut'],seen=new Set();for(const key of keys){const value=values[key];if(typeof value!=='string'||!value||value==='Escape')throw Error('Choose a valid key combination.');const normalized=value.toLowerCase().split('+').sort().join('+');if(seen.has(normalized))throw Error('Each action needs a different shortcut.');seen.add(normalized);}return true;}
 const api={accelerator,label,validate};if(typeof module!=='undefined')module.exports=api;else root.shortcuts=api;
})(globalThis);
