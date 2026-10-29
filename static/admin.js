'use strict';
const $ = id => document.getElementById(id);
let secret = '', teachers = [], bookings = [];
const DATE_LABEL = 'Wednesday, 4 November 2026';
const MEETING_HOURS = '4:00 PM – 7:30 PM (Saudi time)';
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const teacherName = id => teachers.find(t => Number(t.id) === Number(id))?.name || 'Unknown teacher';
const startsAt = slot => Number(String(slot).split(':')[0]) * 60 + Number(String(slot).split(':')[1]);
function timeLabel(slot) {
  if (!/^\d{2}:\d{2}$/.test(String(slot || ''))) return String(slot || '');
  const mins = startsAt(slot), h24 = Math.floor(mins / 60), h = h24 % 12 || 12;
  return `${h}:${String(mins % 60).padStart(2,'0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
function timeRange(slot) {
  const e = startsAt(slot) + 5;
  return `${timeLabel(slot)}–${timeLabel(`${String(Math.floor(e/60)).padStart(2,'0')}:${String(e % 60).padStart(2,'0')}`)}`;
}
const slots = Array.from({length:42},(_,i) => {
  const n = 16*60+i*5;
  return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
});
async function api(path, options={}) {
  const r = await fetch(path, {...options, headers: {'X-Admin-Password':secret, ...(options.headers || {})}, cache:'no-store'});
  if (!r.ok) {
    const j = await r.json().catch(()=>({}));
    throw Error(typeof j.detail === 'string' ? j.detail : `Request failed (${r.status})`);
  }
  return r.json();
}
function note(id, s) { $(id).textContent=s; $(id).classList.remove('hidden'); }
function hideNote(id) { $(id).classList.add('hidden'); }

async function load() {
  [teachers, bookings] = await Promise.all([api('/api/admin/teachers'), api('/api/admin/bookings')]);
  $('teachersCount').textContent=teachers.filter(t=>t.active).length;
  $('bookingsCount').textContent=bookings.length;
  $('remaining').textContent=teachers.filter(t=>t.active).length*42 - bookings.filter(b=>teachers.some(t=>t.id === b.teacher_id && t.active)).length;
  updateTeacherOptions();
  $('logUpdated').textContent = `Updated: ${new Intl.DateTimeFormat('en-GB',{hour:'2-digit', minute:'2-digit',timeZone:'Asia/Riyadh'}).format(new Date())} (Saudi time)`;
  hideNote('logError');
  render();
}
function updateTeacherOptions() {
  const selector=$('logTeacher');
  const before=selector.value;
  selector.innerHTML = `<option value="all">All teachers with bookings</option>` +
    teachers.filter(t => t.active || bookings.some(b => b.teacher_id === t.id))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .map(t=>`<option value="${Number(t.id)}">${esc(t.name)}${t.active?'':' (inactive)'}</option>`).join('');
  selector.value=Array.from(selector.options).some(o=>o.value===before)?before:'all';
  $('logEmpty').disabled=selector.value==='all';
  if(selector.value==='all') $('logEmpty').checked=false;
}
function render() {
  const filter=$('filter').value.toLowerCase();
  $('teacherRows').innerHTML=teachers.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.subject)}</td><td>${esc(t.section)}</td><td>${t.active?'Active':'Inactive'}</td><td>${t.active?`<button class="btn danger" data-disable="${Number(t.id)}">Disable</button>`:''}</td></tr>`).join('');
  $('bookingRows').innerHTML=bookings.filter(b=>Object.values(b).join(' ').toLowerCase().includes(filter)).map(b=>
    `<tr><td>${esc(timeLabel(b.slot))}</td><td>${esc(b.teacher)}</td><td>${esc(b.parent_name)}</td><td>${esc(b.student_name)}</td><td>${esc(b.grade)}</td><td>${esc(b.email)}</td><td>${esc(b.phone)}</td><td><button class="btn danger" data-cancel="${Number(b.id)}">Cancel</button></td></tr>`
  ).join('') || '<tr><td colspan="8">No bookings found.</td></tr>';
  renderLog();
}
const selectedTeacher = () => $('logTeacher').value;
const teacherBookings = teacherId => bookings.filter(b=>Number(b.teacher_id)===Number(teacherId)).sort((a,b)=>a.slot.localeCompare(b.slot));
function selectedBookings({search=true}={}) {
  const pick=selectedTeacher();
  let rows=pick==='all' ? bookings.slice() : teacherBookings(pick);
  if(search && $('logSearch').value.trim()) {
    const q=$('logSearch').value.toLocaleLowerCase();
    rows=rows.filter(b=>[b.student_name,b.parent_name,b.grade,b.teacher,b.subject,b.section,b.slot].join(' ').toLocaleLowerCase().includes(q));
  }
  return rows.sort((a,b)=> (pick==='all' ? a.teacher.localeCompare(b.teacher)||a.slot.localeCompare(b.slot) : a.slot.localeCompare(b.slot)));
}
function scheduleFor(teacherId,includeOpen=false, applySearch=false) {
  const rows=(applySearch?selectedBookings():teacherBookings(teacherId)).filter(b=>Number(b.teacher_id)===Number(teacherId));
  if (!includeOpen) return rows.map(b=>({...b,open:false}));
  const lookup=new Map(teacherBookings(teacherId).map(b=>[b.slot,b]));
  const scheduled=slots.map(slot=>lookup.has(slot) ? {...lookup.get(slot),open:false} : {slot,teacher_id:Number(teacherId),teacher:teacherName(teacherId),open:true});
  if (applySearch && $('logSearch').value.trim()) {
    const matches = new Set(rows.map(b=>b.slot));
    return scheduled.filter(b=>b.open || matches.has(b.slot));
  }
  return scheduled;
}
function renderLog() {
  const pick=selectedTeacher();
  const includeOpen=pick!=='all' && $('logEmpty').checked;
  const rows=pick==='all' ? selectedBookings() : scheduleFor(pick,includeOpen,true);
  const booked=rows.filter(r=>!r.open).length;
  const teacherCount=new Set(selectedBookings().map(b=>b.teacher_id)).size;
  $('logCount').textContent = pick==='all'
    ? `${booked} booked meetings across ${teacherCount} teachers · ${DATE_LABEL}`
    : `${teacherName(pick)}: ${booked} booked of 42 slots` + (includeOpen ? ` · ${42-booked} unbooked` : '');
  $('logRows').innerHTML = rows.map(b=>`<tr class="${b.open?'empty-slot':''}">
    <td>${esc(timeRange(b.slot))}</td>
    <td>${esc(b.teacher||teacherName(b.teacher_id))}</td>
    <td>${b.open?'<span class="subtle">Available</span>':esc(b.student_name)}</td>
    <td>${b.open?'—':esc(b.grade)}</td>
    <td>${b.open?'—':esc(b.parent_name)}</td>
    <td><span class="log-checkbox" aria-hidden="true"></span></td>
  </tr>`).join('') || '<tr><td colspan="6">No appointments booked yet. Select a teacher and tick “Show unbooked slots” to print an empty schedule.</td></tr>';
}

$('signin').onclick=async()=>{
  secret=$('password').value;
  try {
    await load(); $('login').classList.add('hidden');$('dashboard').classList.remove('hidden');$('password').value='';
  } catch(e) { note('loginError', e.message); }
};
$('password').onkeydown=e=>{if(e.key==='Enter')$('signin').click()};
$('addTeacher').onsubmit=async e=>{
  e.preventDefault();
  try {
    const body=Object.fromEntries(new FormData(e.target));
    await api('/api/admin/teachers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    e.target.reset();note('teacherMsg','Teacher added successfully.');await load();
  }catch(err){note('teacherMsg',err.message)}
};
$('importBtn').onclick=async()=>{
  const file=$('teacherFile').files[0];
  if(!file){note('importMsg','Please choose a CSV file first.');return}
  try{
    const result=await api('/api/admin/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv_text:await file.text()})});
    note('importMsg',`${result.added} teachers added.`);await load();
  }catch(e){note('importMsg',e.message)}
};
$('filter').oninput=render;
$('reload').onclick=()=>load().catch(e=>note('logError',e.message));
$('logReload').onclick=()=>load().catch(e=>note('logError',e.message));
$('logTeacher').onchange=()=>{$('logEmpty').disabled=selectedTeacher()==='all';if(selectedTeacher()==='all')$('logEmpty').checked=false;renderLog()};
$('logSearch').oninput=renderLog;
$('logEmpty').onchange=renderLog;
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-cancel],[data-disable]');
  if(!b)return;
  try{
    if(b.dataset.cancel){
      if(!confirm('Cancel this appointment and release the slot?'))return;
      await api('/api/admin/bookings/'+b.dataset.cancel,{method:'DELETE'});
    }else{
      if(!confirm('Hide this teacher from parent bookings? Existing appointments will remain recorded.'))return;
      await api('/api/admin/teachers/'+b.dataset.disable,{method:'DELETE'});
    }
    await load();
  }catch(err){note('logError',err.message)}
});
async function downloadServerCsv(){
  const r=await fetch('/api/admin/export',{headers:{'X-Admin-Password':secret}});
  if(!r.ok)throw Error('Export failed');
  downloadBlob(await r.blob(),'ptm_bookings_2026-11-04.csv');
}
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('export').onclick=()=>downloadServerCsv().catch(e=>alert(e.message));
// Protect CSV files against spreadsheet formula injection in parent/student names.
function csvCell(value) {
  let s=String(value??'').replace(/[\r\n]+/g,' ').trim();
  if (/^[=+\-@\t]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function csvFor(rows) {
  const columns=['Date','Start time','End time','Teacher','Subject','Section','Student','Grade / Class','Parent','Attendance','Follow-up / Notes'];
  const record=b=>{
    const t=teachers.find(t=>Number(t.id)===Number(b.teacher_id)) || {};
    const end=startsAt(b.slot)+5;
    return [DATE_LABEL,timeLabel(b.slot),timeLabel(`${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`),b.teacher||t.name||'',t.subject||b.subject||'',t.section||b.section||'',b.open?'':b.student_name||'',b.open?'':b.grade||'',b.open?'':b.parent_name||'','',''];
  };
  return '\ufeff'+[columns,...rows.map(record)].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
function csvName(pick) {
  const name=pick==='all'?'all_teachers':teacherName(pick).replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,70);
  return `PTM_meeting_log_${name}_2026-11-04.csv`;
}
function saveCsv(rows,pick){downloadBlob(new Blob([csvFor(rows)],{type:'text/csv;charset=utf-8'}),csvName(pick));}
$('logCsv').onclick=()=>{
  const pick=selectedTeacher();
  const rows=pick==='all'?selectedBookings():scheduleFor(pick,$('logEmpty').checked,true);
  if (!rows.length){note('logError','No appointments to export for this selection.');return}
  hideNote('logError'); saveCsv(rows,pick);
};
$('logAllCsv').onclick=()=>{
  if(!bookings.length){note('logError','No confirmed appointments have been booked yet.');return}
  hideNote('logError');
  saveCsv(bookings.slice().sort((a,b)=>a.teacher.localeCompare(b.teacher)||a.slot.localeCompare(b.slot)),'all');
};
function makePrintSection(teacher,rows){
  const booked=rows.filter(b=>!b.open).length;
  return `<section class="teacher-print-sheet">
    <div class="print-school">MANARAT AL RIYADH INTERNATIONAL SCHOOL</div>
    <h1>Parent–Teacher Meeting | Teacher Appointment Log</h1>
    <div class="print-meta"><div><strong>Teacher</strong> ${esc(teacher.name)}</div><div><strong>Subject</strong> ${esc(teacher.subject||'—')}</div><div><strong>School Section</strong> ${esc(teacher.section||'—')}</div><div><strong>Date</strong> ${DATE_LABEL}</div><div><strong>Time</strong> ${MEETING_HOURS}</div><div><strong>Confirmed</strong> ${booked} of 42 slots</div></div>
    <table class="print-table"><thead><tr><th>Appointment time</th><th>Student</th><th>Grade / Class</th><th>Parent</th><th>Attended ✓</th><th>Follow-up / Notes</th></tr></thead>
    <tbody>${rows.map(b=>`<tr class="${b.open?'print-open':''}"><td>${esc(timeRange(b.slot))}</td><td>${b.open?'Available':esc(b.student_name)}</td><td>${b.open?'—':esc(b.grade)}</td><td>${b.open?'—':esc(b.parent_name)}</td><td class="print-tick">□</td><td></td></tr>`).join('')||'<tr><td colspan="6">No appointments booked.</td></tr>'}</tbody></table>
    <div class="print-footer"><div>Teacher signature: _____________________</div><div>Prepared by School Administration · Confidential</div></div>
  </section>`;
}
function buildPrintHTML(){
  const pick=selectedTeacher();
  const filter=$('logSearch').value.trim();
  if(pick==='all') {
    // The all-teachers action prints booked teacher schedules only; do not create 104 empty handouts.
    const matching=selectedBookings();
    const ids=[...new Set(matching.map(b=>Number(b.teacher_id)))];
    const ordered=ids.map(id=>teachers.find(t=>Number(t.id)===id)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
    return ordered.map(t=>makePrintSection(t,matching.filter(b=>Number(b.teacher_id)===Number(t.id)))).join('');
  }
  const t=teachers.find(t=>Number(t.id)===Number(pick));
  return t?makePrintSection(t,scheduleFor(pick,$('logEmpty').checked,!!filter)):'';
}
$('logPrint').onclick=()=>{
  const content=buildPrintHTML();
  if(!content){note('logError','No meeting lists to print yet. Select a teacher and optionally show empty slots.');return}
  hideNote('logError');
  $('printArea').innerHTML=content;
  // Print the current page using dedicated print CSS. Do not expose the admin password in a URL.
  window.print();
};
