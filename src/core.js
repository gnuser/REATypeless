'use strict';
function cleanText(value, dictionary = []) {
  let text = String(value || '').trim().replace(/\[(?:BLANK_AUDIO|SILENCE|MUSIC)\]/gi, '').trim();
  for (const item of dictionary) {
    if (!item.from || !item.to) continue;
    const escaped = item.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = /^[a-z0-9 ]+$/i.test(item.from) ? '\\b' : '';
    text = text.replace(new RegExp(boundary + escaped + boundary, 'gi'), () => item.to);
  }
  return text;
}
function wordCount(text) {
  return (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu) || []).length;
}
function stats(history) {
  const words = history.reduce((n,h)=> n + wordCount(h.text),0);
  const seconds = history.reduce((n,h)=> n + (h.duration || 0),0);
  const dates = [...new Set(history.map(h=> new Date(h.date).toLocaleDateString('en-CA')))].sort();
  let longest=0, streak=0, prior;
  for (const date of dates) { const d=new Date(date+'T12:00:00'); streak=prior && Math.round((d-prior)/86400000)===1 ? streak+1 : 1; longest=Math.max(longest,streak); prior=d; }
  const age=prior ? Math.round((new Date(new Date().toLocaleDateString('en-CA')+'T12:00:00')-prior)/86400000) : 999;
  return {words,seconds,saved:Math.max(0,Math.round(words/40-seconds/60)),wpm:seconds?Math.round(words/seconds*60):0,days:dates.length,streak:age<=1?streak:0,longest,dates};
}
module.exports={cleanText,wordCount,stats};
