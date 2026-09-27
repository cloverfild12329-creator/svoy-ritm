export const UNITS = ['мин', 'ч', 'мл', 'л', 'повт.', 'раз', 'страниц', 'шагов', 'м', 'км', 'сделано'];
export const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function dateFrom(key) { return new Date(key+'T12:00:00'); }
export function uid() { return globalThis.crypto.randomUUID(); }
export function initialState() { return { version: 1, categories: [
  { id: 'health', name: 'Здоровье', color: '#59806b' }, { id: 'growth', name: 'Развитие', color: '#6586af' },
  { id: 'home', name: 'Быт', color: '#ae8056' }, { id: 'self', name: 'Для себя', color: '#9275a6' }
], habits: [], records: {}, rewards: [], redemptions: [], theme: 'auto' }; }
export function configFor(habit, day) { return [...habit.versions].reverse().find(v => v.from <= day); }
export function isScheduled(habit, day) { const v = configFor(habit, day); return !!v && !habit.deleted && (!habit.archived || day < habit.archived) && v.days.includes(dateFrom(day).getDay()); }
export function recordKey(id, day) { return `${id}:${day}`; }
export function recordFor(state, id, day) { return state.records[recordKey(id,day)]; }
export function earned(state) { return Object.values(state.records).reduce((n,r)=> n + (r.value >= r.target ? r.points : 0),0); }
export function balance(state) { return earned(state) - state.redemptions.reduce((n,r)=>n+r.cost,0); }
export function positive(n, name, max=1000000) { if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > max) throw Error(`${name}: введите число больше нуля (до ${max}).`); return n; }
export function validConfig(v, state) {
  if (!v.name?.trim() || v.name.length > 80) throw Error('Название: от 1 до 80 символов.');
  if (!state.categories.some(c=>c.id===v.category)) throw Error('Выберите категорию.');
  if (!v.unit?.trim() || v.unit.length>20) throw Error('Укажите единицу измерения (до 20 символов).');
  positive(v.target,'Цель'); positive(v.step,'Быстрое добавление'); positive(v.points,'Баллы',1000);
  if (!Number.isInteger(v.points)) throw Error('Баллы должны быть целым числом.');
  if (!Array.isArray(v.days) || !v.days.length || new Set(v.days).size!==v.days.length || v.days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw Error('Выберите хотя бы один день недели.');
  if (v.unit==='сделано' && (v.target!==1 || v.step!==1)) throw Error('Для отметки цель и шаг равны 1.');
}
export function saveHabit(state, input, id, today=dateKey()) {
  const v={ ...input, name:input.name.trim(), unit:input.unit.trim() }; validConfig(v,state);
  if (id) {
    const h=state.habits.find(h=>h.id===id); if (!h) throw Error('Привычка не найдена.');
    // Changes always start tomorrow, preserving today's goal and historical awards.
    const next=dateFrom(today); next.setDate(next.getDate()+1); v.from=dateKey(next);
    h.versions=h.versions.filter(x=>x.from<v.from); h.versions.push(v);
  } else state.habits.push({id:uid(),versions:[{...v,from:today}],archived:null});
}
export function setProgress(state,id,day,value) {
  const h=state.habits.find(h=>h.id===id); if (!h || !isScheduled(h,day)) throw Error('На этот день привычка не запланирована.');
  if (day>dateKey()) throw Error('Будущие дни пока нельзя отмечать.');
  if (!Number.isFinite(value)||value<0||value>1000000) throw Error('Введите число от 0 до 1 000 000.');
  const v=configFor(h,day); if(v.unit==='сделано' && ![0,1].includes(value)) throw Error('Выберите сделано или не сделано.');
  const key=recordKey(id,day); const old=state.records[key];
  state.records[key]=old ? {...old,value:Math.round(value*1000)/1000} : {value:Math.round(value*1000)/1000,target:v.target,points:v.points,category:v.category,name:v.name,unit:v.unit,day,habit:id};
}
export function redeem(state,id) {
  const r=state.rewards.find(r=>r.id===id); if(!r) throw Error('Награда не найдена.');
  if(balance(state)<r.cost) throw Error('Пока недостаточно баллов.');
  state.redemptions.push({id:uid(),name:r.name,cost:r.cost,day:dateKey()});
}
export function validateState(s) {
  if(!s || s.version!==1 || !Array.isArray(s.categories) || !Array.isArray(s.habits) || !Array.isArray(s.rewards) || !Array.isArray(s.redemptions) || !s.records || typeof s.records!=='object' || Array.isArray(s.records)) throw Error('Неверный формат резервной копии.');
  if(!['auto','light','dark'].includes(s.theme)) throw Error('Неверная тема.');
  const ids=new Set();
  const ident=o=>{if(typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(o.id)||ids.has(o.id)) throw Error('Повторяющийся или неверный идентификатор.'); ids.add(o.id);};
  const str=(x,n=80)=>{if(typeof x!=='string'||!x.trim()||x.length>n)throw Error('Некорректный текст в копии.');};
  const day=x=>{if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(+dateFrom(x))||dateKey(dateFrom(x))!==x)throw Error('Некорректная дата.');};
  s.categories.forEach(c=>{ident(c);str(c.name,40);if(!/^#[0-9a-f]{6}$/i.test(c.color))throw Error('Неверный цвет.');});
  s.habits.forEach(h=>{ident(h);if(h.deleted!==undefined&&typeof h.deleted!=='boolean')throw Error('Неверный статус привычки.');if(!Array.isArray(h.versions)||!h.versions.length)throw Error('Нет настроек привычки.');let prior='';h.versions.forEach(v=>{validConfig(v,s);day(v.from);if(v.from<=prior)throw Error('Неверный порядок изменений.');prior=v.from;});if(h.archived!==null)day(h.archived);});
  for(const [key,r] of Object.entries(s.records)){day(r.day);const h=s.habits.find(h=>h.id===r.habit);if(!h||key!==recordKey(r.habit,r.day)||!Number.isFinite(r.value)||r.value<0||r.value>1000000)throw Error('Неверная запись.');const v=configFor(h,r.day);if(!v||r.target!==v.target||r.points!==v.points||r.category!==v.category||r.unit!==v.unit||r.name!==v.name||!v.days.includes(dateFrom(r.day).getDay())||(v.unit==='сделано'&&![0,1].includes(r.value)))throw Error('Запись не соответствует цели.');}
  s.rewards.forEach(r=>{ident(r);str(r.name);positive(r.cost,'Цена');if(!Number.isInteger(r.cost))throw Error('Цена должна быть целой.');});
  s.redemptions.forEach(r=>{ident(r);str(r.name);day(r.day);positive(r.cost,'Цена');if(!Number.isInteger(r.cost))throw Error('Цена должна быть целой.');});
  return s;
}
