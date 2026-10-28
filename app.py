import os, sqlite3, csv, io, hmac, secrets, hashlib, re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from argon2 import PasswordHasher

BASE=Path(__file__).resolve().parent
DB=Path(os.environ.get('PTM_DB',str(BASE/'ptm.sqlite3')))
DATE='2026-11-04'
START=16*60; END=19*60+30; INTERVAL=5
SLOTS=[f'{v//60:02d}:{v%60:02d}' for v in range(START,END,INTERVAL)]
app=FastAPI(title='Manarat PTM Booking',docs_url=None,redoc_url=None)
app.mount('/static',StaticFiles(directory=BASE/'static'),name='static')
ph=PasswordHasher()

@contextmanager
def db():
 c=sqlite3.connect(DB,timeout=15,isolation_level=None)
 c.row_factory=sqlite3.Row
 c.execute('PRAGMA busy_timeout=15000')
 c.execute('PRAGMA foreign_keys=ON')
 try: yield c
 finally:c.close()

def init():
 DB.parent.mkdir(parents=True,exist_ok=True)
 with db() as c:
  c.execute('PRAGMA journal_mode=WAL')
  c.executescript('''CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', section TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id), day TEXT NOT NULL, slot TEXT NOT NULL, parent_name TEXT NOT NULL, student_name TEXT NOT NULL, grade TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, UNIQUE(teacher_id,day,slot));
CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_bookings_teacher ON bookings(teacher_id,day);''')
  if not c.execute("SELECT 1 FROM configuration WHERE key='admin_hash'").fetchone():
   password=os.getenv('PTM_ADMIN_PASSWORD','')
   if not password or len(password)<12: raise RuntimeError('Set PTM_ADMIN_PASSWORD to a strong password (12+ characters) before running the application.')
   c.execute("INSERT INTO configuration VALUES('admin_hash',?)",(ph.hash(password),))

@app.on_event('startup')
def start():init()

@app.get('/',response_class=HTMLResponse)
def home():return (BASE/'static'/'index.html').read_text(encoding='utf8')

@app.get('/admin',response_class=HTMLResponse)
def admin_page():return (BASE/'static'/'admin.html').read_text(encoding='utf8')

@app.get('/api/info')
def info():return {'date':DATE,'start':'16:00','end':'19:30','minutes':5,'timezone':'Asia/Riyadh','slots_per_teacher':len(SLOTS)}

@app.get('/api/teachers')
def teachers():
 with db() as c:
  return [dict(x) for x in c.execute('SELECT id,name,subject,section FROM teachers WHERE active=1 ORDER BY section,name').fetchall()]

@app.get('/api/availability/{teacher_id}')
def availability(teacher_id:int):
 with db() as c:
  t=c.execute('SELECT id FROM teachers WHERE id=? AND active=1',(teacher_id,)).fetchone()
  if not t:raise HTTPException(404,'Teacher not found')
  booked={x['slot'] for x in c.execute('SELECT slot FROM bookings WHERE teacher_id=? AND day=?',(teacher_id,DATE))}
  return {'date':DATE,'slots':[{'time':s,'available':s not in booked} for s in SLOTS]}

class BookingIn(BaseModel):
 teacher_id:int
 slot:str
 parent_name:str=Field(min_length=2,max_length=120)
 student_name:str=Field(min_length=2,max_length=120)
 grade:str=Field(min_length=1,max_length=30)
 email:str=Field(min_length=3,max_length=200)
 phone:str=Field(default='',max_length=40)

@app.post('/api/book',status_code=201)
def book(b:BookingIn):
 if b.slot not in SLOTS:raise HTTPException(400,'Invalid appointment time')
 if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',b.email):raise HTTPException(400,'Valid email required')
 if any(not x.strip() for x in [b.parent_name,b.student_name,b.grade]):raise HTTPException(400,'Please complete all required fields')
 code=secrets.token_urlsafe(15)
 with db() as c:
  try:
   c.execute('BEGIN IMMEDIATE')
   t=c.execute('SELECT name FROM teachers WHERE id=? AND active=1',(b.teacher_id,)).fetchone()
   if not t:raise HTTPException(404,'Teacher not found')
   c.execute('''INSERT INTO bookings (teacher_id,day,slot,parent_name,student_name,grade,email,phone,code,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)''',(b.teacher_id,DATE,b.slot,b.parent_name.strip(),b.student_name.strip(),b.grade.strip(),b.email.strip(),b.phone.strip(),code,datetime.now(timezone.utc).isoformat()))
   c.execute('COMMIT')
  except sqlite3.IntegrityError:
   c.execute('ROLLBACK')
   raise HTTPException(409,'This appointment has just been booked. Please select another time.')
  except Exception:
   if c.in_transaction:c.execute('ROLLBACK')
   raise
 return {'confirmation_code':code,'teacher':t['name'],'slot':b.slot,'date':DATE}

@app.get('/api/booking/{code}')
def booking_lookup(code:str):
 with db() as c:
  x=c.execute('SELECT b.day,b.slot,b.student_name,t.name AS teacher FROM bookings b JOIN teachers t ON t.id=b.teacher_id WHERE b.code=?',(code,)).fetchone()
  if not x:raise HTTPException(404,'Booking not found')
  return dict(x)

def auth(password:Optional[str]):
 if not password:raise HTTPException(401,'Administrator password required')
 with db() as c:h=c.execute("SELECT value FROM configuration WHERE key='admin_hash'").fetchone()['value']
 try:valid=ph.verify(h,password)
 except Exception:valid=False
 if not valid:raise HTTPException(401,'Incorrect administrator password')

@app.get('/api/admin/teachers')
def admin_teachers(x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 with db() as c:return [dict(x) for x in c.execute('SELECT * FROM teachers ORDER BY name')]

class TeacherIn(BaseModel):
 name:str=Field(min_length=2,max_length=120)
 subject:str=Field(default='',max_length=120)
 section:str=Field(default='',max_length=120)

@app.post('/api/admin/teachers',status_code=201)
def add_teacher(b:TeacherIn,x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 with db() as c:
  cur=c.execute('INSERT INTO teachers(name,subject,section) VALUES(?,?,?)',(b.name.strip(),b.subject.strip(),b.section.strip()))
  return {'id':cur.lastrowid}

@app.delete('/api/admin/teachers/{teacher_id}')
def disable_teacher(teacher_id:int,x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 with db() as c:
  c.execute('UPDATE teachers SET active=0 WHERE id=?',(teacher_id,))
 return {'ok':True}

@app.get('/api/admin/bookings')
def get_bookings(x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 with db() as c:
  return [dict(x) for x in c.execute('''SELECT b.id,b.teacher_id,b.day,b.slot,b.parent_name,b.student_name,b.grade,b.email,b.phone,b.code,b.created_at,t.name AS teacher,t.subject,t.section FROM bookings b JOIN teachers t ON t.id=b.teacher_id ORDER BY t.name,b.slot''')]

@app.delete('/api/admin/bookings/{booking_id}')
def cancel(booking_id:int,x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 with db() as c:
  cur=c.execute('DELETE FROM bookings WHERE id=?',(booking_id,))
  if not cur.rowcount:raise HTTPException(404,'Booking not found')
 return {'ok':True}

@app.get('/api/admin/export')
def export(x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 rows=get_bookings(x_admin_password)
 out=io.StringIO();cols=['day','slot','teacher','subject','section','parent_name','student_name','grade','email','phone','code','created_at'];w=csv.DictWriter(out,fieldnames=cols,extrasaction='ignore');w.writeheader();w.writerows(rows)
 return StreamingResponse(iter([out.getvalue().encode('utf-8-sig')]),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="ptm_bookings_2026-11-04.csv"'})

class BulkTeachers(BaseModel):
 csv_text:str=Field(max_length=200000)

@app.post('/api/admin/import')
def import_teachers(b:BulkTeachers,x_admin_password:Optional[str]=Header(default=None)):
 auth(x_admin_password)
 reader=csv.DictReader(io.StringIO(b.csv_text.lstrip('\ufeff')))
 if not reader.fieldnames or 'name' not in [x.lower().strip() for x in reader.fieldnames]:raise HTTPException(400,'CSV must include name header, optional subject and section')
 n=0
 with db() as c:
  for row in reader:
   r={k.lower().strip():str(v or '').strip() for k,v in row.items() if k}
   if not r.get('name'):continue
   exists=c.execute('SELECT id FROM teachers WHERE lower(name)=lower(?)',(r['name'],)).fetchone()
   if exists:continue
   c.execute('INSERT INTO teachers(name,subject,section) VALUES(?,?,?)',(r['name'][:120],r.get('subject','')[:120],r.get('section','')[:120]));n+=1
 return {'added':n}
