const test=require('node:test'),assert=require('node:assert/strict');const {accelerator,validate}=require('../src/shortcuts');
test('uses physical key with Option instead of macOS accented character',()=>assert.equal(accelerator({code:'KeyD',key:'∂',altKey:true,shiftKey:true}),'Alt+Shift+D'));
test('captures modifiers and Space',()=>assert.equal(accelerator({code:'Space',ctrlKey:true,metaKey:true}),'Command+Control+Space'));
test('ignores modifier-only, typing, repeat, IME and reserved Escape',()=>{for(const e of [{code:'AltLeft',altKey:true},{code:'KeyA'},{code:'KeyA',shiftKey:true},{code:'KeyA',ctrlKey:true,repeat:true},{code:'KeyA',ctrlKey:true,isComposing:true},{code:'Escape',ctrlKey:true}])assert.equal(accelerator(e),null);});
test('rejects duplicate combos regardless of modifier order',()=>assert.throws(()=>validate({shortcut:'Command+Shift+D',translateShortcut:'Shift+Command+D',askShortcut:'Alt+A'}),/different/));
