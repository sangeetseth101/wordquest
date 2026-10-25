"""WordQuest web app. Run locally with python app.py; use Gunicorn in production."""
from collections import defaultdict, deque
from functools import wraps
import json
import logging
import os
import re
import secrets
import threading
import time
import urllib.parse
from flask import Flask, request, jsonify, g, make_response, send_from_directory
from werkzeug.exceptions import HTTPException
import learning
import tutor
from storage import ROOT, DEFAULT_PROFILE, db, init_db, password_hash, password_ok, token_hash, user_public, dumps, get_config, set_config, api_key, save_api_key

app=Flask(__name__,static_folder='public',static_url_path='/assets')
app.config['MAX_CONTENT_LENGTH']=16000
ORIGIN=os.environ.get('APP_ORIGIN','http://127.0.0.1:4173').rstrip('/')
HOST=urllib.parse.urlparse(ORIGIN).netloc
LOCAL=HOST in ('127.0.0.1:4173','localhost:4173')
COOKIE='wordquest_session'
limits=defaultdict(deque)
limit_lock=threading.Lock()
# A dummy hash keeps unknown-account login work similar to known accounts.
DUMMY_HASH=password_hash(secrets.token_urlsafe(24))
init_db()

def fail(message,status=400,code='bad_request'):
    return jsonify({'error':message,'code':code}),status

def body():
    data=request.get_json(silent=True)
    if not isinstance(data,dict):raise ValueError('Send a JSON object.')
    return data

def limited(key,count,seconds):
    with limit_lock:
        now=time.time();q=limits[key]
        while q and q[0]<now-seconds:q.popleft()
        if len(q)>=count:return True
        q.append(now)
        if len(limits)>2000:
            for k in list(limits):
                if not limits[k] or limits[k][-1]<now-3600:del limits[k]
        return False

@app.before_request
def secure_request():
    allowed={HOST}
    if LOCAL:allowed.update(('127.0.0.1:4173','localhost:4173'))
    if request.host not in allowed and not app.testing:return fail('Unrecognised host.',400)
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('Origin')
        valid={ORIGIN}
        if LOCAL:valid.update(('http://127.0.0.1:4173','http://localhost:4173'))
        if origin not in valid:return fail('This request must come from WordQuest.',403,'origin_rejected')
        if not request.is_json:return fail('Use application/json.',415)
    g.user=None;g.session=None
    raw=request.cookies.get(COOKIE,'')
    if raw and len(raw)<200:
        with db() as conn:
            row=conn.execute('SELECT users.*,sessions.csrf,sessions.token_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?',(token_hash(raw),time.time())).fetchone()
        if row:g.user=row;g.session=row

@app.after_request
def headers(response):
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['Permissions-Policy']='camera=(),geolocation=(),microphone=(self)'
    response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if request.path.startswith('/api/') or request.path=='/':response.headers['Cache-Control']='no-store'
    return response

def auth(role=None):
    def wrap(fn):
        @wraps(fn)
        def wrapped(*args,**kwargs):
            if not g.user:return fail('Please sign in again.',401,'unauthenticated')
            if role and g.user['role']!=role:return fail('Guardian access is required.',403,'forbidden')
            if request.method not in ('GET','HEAD') and not secrets.compare_digest(request.headers.get('X-CSRF-Token',''),g.session['csrf']):return fail('Your session changed. Please refresh.',403,'csrf_rejected')
            return fn(*args,**kwargs)
        return wrapped
    return wrap

@app.errorhandler(ValueError)
def invalid(e):return fail(str(e),400)
@app.errorhandler(tutor.AIError)
def ai_error(e):return fail(e.message,503,e.code)
@app.errorhandler(Exception)
def error(e):
    if isinstance(e,HTTPException):return fail(e.description,e.code)
    logging.error('WordQuest request failed (%s)',type(e).__name__)
    return fail('Something went wrong. Your progress is safe; please retry.',500,'server_error')

@app.get('/')
def index():return send_from_directory(app.static_folder,'index.html')
@app.get('/health')
def health():return jsonify({'status':'ok'})
@app.get('/api/session')
def session():
    if not g.user:return jsonify({'user':None,'ai':{'connected':tutor.available()}})
    result={'user':user_public(g.user),'csrf':g.session['csrf'],'ai':{'connected':tutor.available(),'model':get_config().get('model',tutor.MODEL)}}
    if g.user['role']=='learner':result.update({'stats':learning.stats(g.user['id']),'active':learning.active_adventure(g.user['id']),'recommendation':learning.recommendation(g.user)})
    return jsonify(result)

@app.post('/api/login')
def login():
    data=body();username=data.get('username','');password=data.get('password','')
    if not isinstance(username,str) or not isinstance(password,str) or len(username)>60 or len(password)>256:return fail('Check your username and password.',401)
    if limited(('login-ip',request.remote_addr),15,900) or limited(('login-name',username.lower()),10,900):return fail('Too many sign-in attempts. Try again in 15 minutes.',429)
    with db() as conn:
        user=conn.execute('SELECT * FROM users WHERE username=?',(username.strip().lower(),)).fetchone()
    good=password_ok(password,user['password_hash'] if user else DUMMY_HASH)
    if not user or not good:return fail('That username or password is not right. Try again.',401,'invalid_login')
    token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(24)
    with db() as conn:
        conn.execute('INSERT INTO sessions VALUES(?,?,?,?)',(token_hash(token),user['id'],csrf,time.time()+7*86400))
    response=make_response(jsonify({'user':user_public(user),'csrf':csrf}))
    response.set_cookie(COOKIE,token,httponly=True,secure=ORIGIN.startswith('https:'),samesite='Strict',max_age=7*86400,path='/')
    return response

@app.post('/api/logout')
@auth()
def logout():
    with db() as conn:conn.execute('DELETE FROM sessions WHERE token_hash=?',(g.session['token_hash'],))
    r=make_response(jsonify({'ok':True}));r.delete_cookie(COOKIE);return r

@app.patch('/api/profile')
@auth('learner')
def profile():
    data=body();p=json.loads(g.user['profile'])
    for k in ('mic','typing','autoVoice','onboarded','autoLevel'):
        if k in data and type(data[k]) is bool:p[k]=data[k]
    if data.get('level') in learning.LEVEL_IDS:p['level']=data['level']
    if data.get('mood') in ('ready','curious','tired','frustrated'):p['mood']=data['mood']
    if type(data.get('goal')) is int and 1<=data['goal']<=4:p['goal']=data['goal']
    if data.get('rate') in (0.65,0.82,1):p['rate']=data['rate']
    for k in ('voice','hiVoice'):
        if k in data and isinstance(data[k],str) and len(data[k])<150:p[k]=data[k]
    if 'interests' in data:
        if not isinstance(data['interests'],list):raise ValueError('Choose a few interests.')
        choices=('cricket','football','animals','space','nature','games','art','food','music','school')
        p['interests']=[v for v in data['interests'] if v in choices][:5]
    with db() as conn:conn.execute('UPDATE users SET profile=? WHERE id=?',(dumps(p),g.user['id']))
    return jsonify({'profile':p})

@app.get('/api/library')
@auth('learner')
def library():return jsonify(learning.CURRICULUM)

@app.get('/api/dashboard')
@auth('learner')
def dashboard():
    with db() as conn:
        rows=conn.execute('SELECT * FROM adventures WHERE user_id=? ORDER BY created_at DESC LIMIT 12',(g.user['id'],)).fetchall()
    return jsonify({'stats':learning.stats(g.user['id']),'active':learning.active_adventure(g.user['id']),'recommendation':learning.recommendation(g.user),'adventures':[learning.public_adventure(r) for r in rows],'ai':{'connected':tutor.available()}})

@app.post('/api/adventures')
@auth('learner')
def adventures():
    data=body()
    if limited(('adventure',g.user['id']),6,60):return fail('Let’s finish a little practice first. Try again in a minute.',429)
    if data.get('mode')=='ai':
        ctx=learning.context(g.user);lesson=tutor.generate(g.user['id'],ctx);lesson.update({'level':ctx['level'],'source':'ai','topic':'Personalised'})
    elif data.get('template'):
        match=next((x for x in learning.CURRICULUM['lessons'] if x['id']==data['template']),None)
        if not match:return fail('Lesson not found.',404)
        lesson={'title':match['title'],'intro':'Chalo, saath mein padhenge.','scene':'A little practice, at your own pace.','items':[dict(x) for x in match['items']],'template':match['id'],'level':match['level'],'source':'prepared','topic':match['topic']}
    else:lesson=learning.prepared(g.user)
    return jsonify(learning.create_adventure(g.user,lesson)),201

@app.get('/api/adventures/<adventure_id>')
@auth('learner')
def adventure(adventure_id):
    with db() as conn:row=conn.execute('SELECT * FROM adventures WHERE id=? AND user_id=?',(adventure_id,g.user['id'])).fetchone()
    if not row:return fail('Adventure not found.',404)
    return jsonify(learning.public_adventure(row))

@app.post('/api/adventures/<adventure_id>/answer')
@auth('learner')
def answer(adventure_id):
    data=body();event_id=data.get('eventId','');stage=data.get('stage');value=data.get('value');expected_index=data.get('itemIndex');assisted=data.get('assisted') is True
    if not isinstance(event_id,str) or not re.fullmatch(r'[a-f0-9-]{16,50}',event_id):raise ValueError('A valid attempt ID is required.')
    if type(expected_index) is not int or not 0<=expected_index<=3:raise ValueError('A valid item position is required.')
    if stage not in learning.STAGES:raise ValueError('Unknown activity.')
    if not isinstance(value,(str,bool)) or isinstance(value,str) and len(value)>600:raise ValueError('Please keep the answer short.')
    grade=None
    if stage=='meaning' and data.get('freeText') is True:
        with db() as conn:
            prior=conn.execute('SELECT response FROM events WHERE id=? AND user_id=?',(event_id,g.user['id'])).fetchone()
            row=conn.execute('SELECT * FROM adventures WHERE id=? AND user_id=?',(adventure_id,g.user['id'])).fetchone()
        if prior:
            result=json.loads(prior['response']);result['stats']=learning.stats(g.user['id']);return jsonify(result)
        if not row:return fail('Adventure not found.',404)
        progress=json.loads(row['progress']);content=json.loads(row['data'])
        if progress['stage']!='meaning' or progress['index']!=expected_index or row['completed_at']:raise ValueError('This meaning activity is no longer active.')
        item=content['items'][progress['index']]
        if not isinstance(value,str) or not value.strip():raise ValueError('Tell Pip what it means, or choose an option.')
        grade=tutor.grade(g.user['id'],item,value)
    result=learning.answer(g.user,adventure_id,event_id,stage,value,assisted,grade,expected_index)
    result['stats']=learning.stats(g.user['id'])
    return jsonify(result)

@app.get('/api/words')
@auth('learner')
def words():return jsonify({'words':learning.word_collection(g.user['id'])})

@app.get('/api/tutor/messages')
@auth('learner')
def messages():
    with db() as conn:
        rows=conn.execute('SELECT role,text,source,created_at,speech,english,prompt FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 40',(g.user['id'],)).fetchall()
    return jsonify({'messages':[dict(r) for r in reversed(rows)]})

@app.post('/api/tutor/chat')
@auth('learner')
def chat():
    data=body();message=data.get('message','')
    if not isinstance(message,str) or not message.strip() or len(message)>600:raise ValueError('Send a short message, up to 600 characters.')
    if limited(('chat',g.user['id']),8,60):return fail('Give Pip a moment. Try again shortly.',429)
    with db() as conn:
        rows=conn.execute('SELECT role,text FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 12',(g.user['id'],)).fetchall()
    ctx=learning.context(g.user)
    if tutor.available():
        data=tutor.chat(g.user['id'],ctx,[{'role':r['role'],'content':r['text']} for r in reversed(rows)],message.strip());source='ai'
    else:
        source='practice'
        if re.search(r'\b(tired|thak|sad|mushkil|hard|nahi aata)\b',message,re.I):reply='Koi jaldi nahi hai. Ek chhota break le sakte ho. Phir saath mein sirf ek word try karenge.'
        elif re.search(r'\b(hello|hi|hey|namaste)\b',message,re.I):reply=f"Hi {ctx['firstName']}! Main Pip, tumhara AI reading coach hoon. Abhi practice mode hai; guardian AI connect karenge toh hum freely baat kar sakenge."
        else:reply='Abhi prepared practice mode hai, isliye main tumhara message freely samajh nahi sakta. Guardian AI connect kar sakte hain. Tab tak ek chhota word saath padhein?'
        target=(ctx['reviewWords'][0]['word'] if ctx['reviewWords'] else 'bag')
        data={'reply':reply,'speak':reply,'english':target,'prompt':f'Can you read “{target}”?'}
    with db() as conn:
        for role,text in [('user',message.strip()),('assistant',data['reply'])]:
            conn.execute('INSERT INTO messages(user_id,role,text,source,created_at,speech,english,prompt) VALUES(?,?,?,?,?,?,?,?)',(g.user['id'],role,text,source,time.time(),data['speak'] if role=='assistant' else '',data['english'] if role=='assistant' else '',data['prompt'] if role=='assistant' else ''))
        conn.execute('DELETE FROM messages WHERE user_id=? AND id NOT IN (SELECT id FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 200)',(g.user['id'],g.user['id']))
    return jsonify({**data,'source':source})

@app.get('/api/guardian')
@auth('guardian')
def guardian():
    with db() as conn:
        users=conn.execute("SELECT * FROM users WHERE role='learner'").fetchall()
        usage=conn.execute('SELECT count(*) calls,coalesce(sum(tokens),0) tokens,coalesce(sum(cost),0) cost FROM usage WHERE created_at>?',(time.time()-86400,)).fetchone()
    config=get_config()
    return jsonify({'learners':[{'user':user_public(u),'stats':learning.stats(u['id']),'recommendation':learning.recommendation(u),'words':learning.word_collection(u['id'])[:12]} for u in users],'ai':{'configured':bool(api_key()),'connected':tutor.available(),'model':config.get('model',tutor.MODEL),'dailyLimit':config.get('daily_limit',100),'testedAt':config.get('tested_at'),'usage':dict(usage)}})

@app.post('/api/guardian/ai')
@auth('guardian')
def configure_ai():
    data=body();values={}
    key=data.get('key','')
    if not isinstance(key,str) or len(key)>300:raise ValueError('Enter a valid OpenRouter key.')
    if key:
        if not re.fullmatch(r'sk-or-[A-Za-z0-9_-]{10,250}',key):raise ValueError('That does not look like an OpenRouter key.')
        values['tested_at']=None
    if 'enabled' in data:
        if type(data['enabled']) is not bool:raise ValueError('Choose whether AI is enabled.')
        values['ai_enabled']=data['enabled']
    model=data.get('model',tutor.MODEL)
    if model not in ('openai/gpt-4.1-mini','google/gemini-2.5-flash','openai/gpt-5-mini'):raise ValueError('Choose one of the supported models.')
    values['model']=model
    limit=data.get('dailyLimit',100)
    if type(limit) is not int or not 10<=limit<=500:raise ValueError('Choose a daily AI call limit between 10 and 500.')
    values['daily_limit']=limit
    if key:save_api_key(key)
    set_config(values)
    return jsonify({'ok':True,'connected':tutor.available()})

@app.post('/api/guardian/ai/test')
@auth('guardian')
def test_ai():
    result=tutor.complete(g.user['id'],'test',[{'role':'user','content':'Say hello to a young English learner. Return {"message":"Hello! Let us read together."}.'}],tutor.object_schema({'message':tutor.STRING}))
    message=tutor.safe_string(result.get('message'),200);set_config({'tested_at':time.time()})
    return jsonify({'ok':True,'message':message})

@app.post('/api/guardian/password')
@auth('guardian')
def change_password():
    data=body();password=data.get('password','');target=data.get('userId',g.user['id']);current=data.get('currentPassword','')
    if not isinstance(current,str) or not password_ok(current,g.user['password_hash']):return fail('Confirm your guardian password first.',403)
    if not isinstance(password,str) or not 12<=len(password)<=128:raise ValueError('Use a password of 12–128 characters.')
    with db() as conn:
        exists=conn.execute('SELECT id FROM users WHERE id=?',(target,)).fetchone()
        if not exists:return fail('Account not found.',404)
        conn.execute('UPDATE users SET password_hash=? WHERE id=?',(password_hash(password),target))
        conn.execute('DELETE FROM sessions WHERE user_id=?',(target,))
    return jsonify({'ok':True,'signInAgain':target==g.user['id']})

if __name__=='__main__':
    app.run(host=os.environ.get('HOST','127.0.0.1'),port=int(os.environ.get('PORT','4173')),debug=False,threaded=True)
