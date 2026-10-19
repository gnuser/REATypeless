const test=require('node:test');const assert=require('node:assert/strict');const {cleanText,wordCount,stats}=require('../src/core');
test('dictionary handles Chinese, word boundaries and literal dollar replacement',()=>{assert.equal(cleanText('cat category 雷亚 $x',[{from:'cat',to:'dog'},{from:'雷亚',to:'REA'},{from:'$x',to:'$&'}]),'dog category REA $&');});
test('blank audio is never inserted',()=>assert.equal(cleanText('[BLANK_AUDIO]'),''));
test('mixed-language usage counts',()=>assert.equal(wordCount('你好 hello world'),4));
test('empty history has zero metrics',()=>{const s=stats([]);for(const k of ['words','seconds','saved','wpm','days','streak','longest'])assert.equal(s[k],0);});
test('streaks use unique days and break at gaps',()=>{const s=stats([{date:'2025-01-01T12:00:00',text:'one',duration:1},{date:'2025-01-02T12:00:00',text:'two',duration:1},{date:'2025-01-02T14:00:00',text:'three',duration:1},{date:'2025-01-04T12:00:00',text:'four',duration:1}]);assert.equal(s.days,3);assert.equal(s.longest,2);assert.equal(s.streak,0);});
