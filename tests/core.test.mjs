import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, saveHabit, dateKey, dateFrom, setProgress, balance, redeem, validateState, configFor, isScheduled } from '../public/core.js';
const today=dateKey();
const input={name:'Вода',category:'health',unit:'л',target:2,step:.25,points:10,days:[0,1,2,3,4,5,6]};
function setup(){const s=initialState();saveHabit(s,input,null,today);return [s,s.habits[0].id];}
test('Partial progress, reaching goal and overflow award once',()=>{const [s,id]=setup();setProgress(s,id,today,1.75);assert.equal(balance(s),0);setProgress(s,id,today,2);assert.equal(balance(s),10);setProgress(s,id,today,3);assert.equal(balance(s),10);validateState(s);});
test('Corrections reverse awards; spending is preserved and cannot overspend',()=>{const [s,id]=setup();setProgress(s,id,today,2);s.rewards.push({id:'book',name:'Книга',cost:10});redeem(s,'book');assert.equal(balance(s),0);assert.throws(()=>redeem(s,'book'));setProgress(s,id,today,1);assert.equal(balance(s),-10);setProgress(s,id,today,2);assert.equal(balance(s),0);assert.equal(s.redemptions.length,1);validateState(s);});
test('Same-day edits recalculate awards while preserving history and replacing pending versions',()=>{
 const s=initialState(),d=dateFrom(today);d.setDate(d.getDate()-1);const yesterday=dateKey(d);
 saveHabit(s,input,null,yesterday);const h=s.habits[0],id=h.id;
 setProgress(s,id,yesterday,2);setProgress(s,id,today,2);
 d.setDate(d.getDate()+2);h.versions.push({...input,from:dateKey(d),target:9});
 saveHabit(s,{...input,target:3,points:20},id,today);
 assert.equal(configFor(h,today).target,3);assert.equal(balance(s),10);
 assert.equal(s.records[id+':'+today].value,2);assert.equal(s.records[id+':'+yesterday].points,10);
 saveHabit(s,{...input,target:1,points:15,name:'Водичка'},id,today);
 assert.equal(balance(s),25);assert.equal(h.versions.length,2);validateState(s);
});
test('Unit and schedule edits are valid immediately',()=>{
 const [s,id]=setup();setProgress(s,id,today,2);
 saveHabit(s,{...input,days:[(dateFrom(today).getDay()+1)%7]},id,today);
 assert.equal(isScheduled(s.habits[0],today),false);assert.equal(balance(s),10);validateState(s);
 saveHabit(s,{...input,unit:'сделано',target:1,step:1},id,today);
 assert.equal(s.records[id+':'+today].value,0);assert.equal(balance(s),0);validateState(s);
});
test('Deleting removes all habit experience, keeps spending and does not affect other habits',()=>{
 const [s,id]=setup();setProgress(s,id,today,2);
 saveHabit(s,{...input,name:'Ещё вода'},null,today);setProgress(s,s.habits[1].id,today,2);
 s.rewards.push({id:'book',name:'Книга',cost:15});redeem(s,'book');
 s.habits[0].deleted=true;assert.equal(balance(s),-5);assert.equal(Object.keys(s.records).length,2);
 assert.equal(s.redemptions.length,1);assert.throws(()=>redeem(s,'book'));validateState(s);
});
test('Schedules and archive are date aware',()=>{const [s]=setup();const h=s.habits[0];h.versions[0].days=[(dateFrom(today).getDay()+1)%7];assert.equal(isScheduled(h,today),false);assert.throws(()=>setProgress(s,h.id,today,1));h.versions[0].days=input.days;h.archived=today;assert.equal(isScheduled(h,today),false);});
test('Invalid values and corrupted backups are rejected',()=>{const [s,id]=setup();for(const n of [-1,NaN,Infinity,1000001])assert.throws(()=>setProgress(s,id,today,n));assert.throws(()=>saveHabit(s,{...input,days:[]},null));assert.throws(()=>validateState({...s,version:2}));const bad=structuredClone(s);bad.habits[0].id='\" onclick=\"bad';assert.throws(()=>validateState(bad));setProgress(s,id,today,2);s.records[`${id}:${today}`].points=999;assert.throws(()=>validateState(s));});
test('Checkbox can be undone without duplicate rewards',()=>{const s=initialState();saveHabit(s,{...input,unit:'сделано',target:1,step:1},null,today);const id=s.habits[0].id;setProgress(s,id,today,1);setProgress(s,id,today,1);assert.equal(balance(s),10);setProgress(s,id,today,0);assert.equal(balance(s),0);assert.throws(()=>setProgress(s,id,today,.5));});
test('Fractional units accumulate without floating point drift',()=>{const [s,id]=setup();let value=0;for(let i=0;i<20;i++){setProgress(s,id,today,value+.1);value=s.records[`${id}:${today}`].value;}assert.equal(value,2);assert.equal(balance(s),10);validateState(JSON.parse(JSON.stringify(s)));});
