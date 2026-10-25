"""Evidence-based practice scheduling. Self-reported speech never drives promotion."""
import json
import random
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from storage import ROOT, db, dumps

CURRICULUM=json.loads((ROOT/'curriculum.json').read_text())
LEVELS=CURRICULUM['levels']
LEVEL_IDS=[l['id'] for l in LEVELS]
STAGES=['listen','read','type','meaning','recap']

def normal(text):
    return re.sub(r'[^\w]','',text.casefold(),flags=re.UNICODE)

def steps(profile):
    return [s for s in STAGES if not (s=='read' and not profile.get('mic',True)) and not (s=='type' and not profile.get('typing',True))]

def stats(user_id):
    with db() as conn:
        completed=conn.execute('SELECT count(*) FROM adventures WHERE user_id=? AND completed_at IS NOT NULL',(user_id,)).fetchone()[0]
        attempts=conn.execute("SELECT kind,correct,assisted,word,created_at FROM events WHERE user_id=? AND kind IN ('listen','read','type','meaning') ORDER BY created_at",(user_id,)).fetchall()
        known={(r['word'],r['kind']) for r in attempts if r['correct']}
        scored=[r for r in attempts if r['kind'] in ('type','meaning') and not r['assisted']]
        recent=scored[-30:]
        days={r['day']:r['n'] for r in conn.execute("SELECT date(completed_at,'unixepoch','+5 hours','+30 minutes') day,count(*) n FROM adventures WHERE user_id=? AND completed_at IS NOT NULL GROUP BY day",(user_id,))}
        due=conn.execute("SELECT count(DISTINCT word) FROM skills WHERE user_id=? AND stage IN ('type','meaning') AND due_at<=?",(user_id,time.time())).fetchone()[0]
    today=(datetime.now(timezone.utc)+timedelta(hours=5,minutes=30)).date()
    cursor=today if str(today) in days else today-timedelta(days=1)
    streak=0
    while str(cursor) in days:
        streak+=1;cursor-=timedelta(days=1)
    return {'xp':sum(10 if k=='meaning' else 5 for _,k in known)+completed*20,'completed':completed,'stars':completed*3,'words':len({w for w,_ in known}),'spelling':len({w for w,k in known if k=='type'}),'meaning':len({w for w,k in known if k=='meaning'}),'accuracy':round(sum(r['correct'] for r in recent)/len(recent)*100) if recent else None,'scoredAttempts':len(recent),'today':days.get(str(today),0),'streak':streak,'due':due,'days':days}

def recommendation(user):
    profile=json.loads(user['profile']);level=profile['level'];reason='We’ll start with your chosen level and learn from your attempts.'
    with db() as conn:
        scored=conn.execute("SELECT events.correct FROM events JOIN adventures ON adventures.id=events.adventure_id WHERE events.user_id=? AND events.kind IN ('type','meaning') AND events.assisted=0 AND json_extract(adventures.data,'$.level')=? ORDER BY events.created_at DESC LIMIT 30",(user['id'],level)).fetchall()
        completed=conn.execute("SELECT count(*) FROM adventures WHERE user_id=? AND completed_at IS NOT NULL AND json_extract(data,'$.level')=?",(user['id'],level)).fetchone()[0]
    s={'scoredAttempts':len(scored),'accuracy':sum(r['correct'] for r in scored)/len(scored)*100 if scored else 0,'completed':completed}
    i=LEVEL_IDS.index(level)
    if profile.get('autoLevel',True) and s['scoredAttempts']>=12:
        if s['accuracy']>=85 and s['completed']>=3 and i<4:
            level=LEVEL_IDS[i+1];reason='Your recent spelling and meaning answers suggest trying one small step up.'
        elif s['accuracy']<55 and i>0:
            level=LEVEL_IDS[i-1];reason='A gentler adventure will give tricky words more time.'
        else: reason='We’re keeping the level steady and revisiting words that need practice.'
    return {'level':level,'reason':reason}

def context(user):
    profile=json.loads(user['profile']);rec=recommendation(user)
    with db() as conn:
        due=conn.execute("SELECT word,english,hindi,roman,max(attempts-successes) misses FROM skills WHERE user_id=? AND stage IN ('type','meaning') AND due_at<=? GROUP BY word ORDER BY misses DESC,due_at LIMIT 6",(user['id'],time.time())).fetchall()
        recent=conn.execute('SELECT word FROM events WHERE user_id=? ORDER BY created_at DESC LIMIT 30',(user['id'],)).fetchall()
    return {'firstName':user['display_name'].split()[0],'level':rec['level'],'interests':profile.get('interests',[]),'mood':profile.get('mood','ready'),'reviewWords':[{'word':r['word'],'english':r['english'],'hindi':r['hindi'],'roman':r['roman']} for r in due],'recentWords':list(dict.fromkeys(r['word'] for r in recent))[:12],'learning':stats(user['id']),'guidance':rec['reason']}

def prepared(user):
    ctx=context(user);level=ctx['level'];interests=' '.join(ctx['interests']).lower();topics=[]
    if any(w in interests for w in ('cricket','football','sport','games')):topics.append('Play')
    if any(w in interests for w in ('animal','dog','cat')):topics.extend(['Animals','Nature'])
    if any(w in interests for w in ('space','nature','plant')):topics.append('Nature')
    pool=[l for l in CURRICULUM['lessons'] if l['level']==level]
    with db() as conn:
        past=[json.loads(r['data']).get('template') for r in conn.execute('SELECT data FROM adventures WHERE user_id=? ORDER BY created_at DESC LIMIT 4',(user['id'],))]
    choices=[l for l in pool if l['id'] not in past] or pool
    preferred=[l for l in choices if l['topic'] in topics]
    lesson=random.SystemRandom().choice(preferred or choices)
    data={'title':lesson['title'],'intro':'Chalo, ek chhoti adventure karein. Aaj ki practice tumhari learning ke hisaab se chuni hai.','scene':ctx['guidance'],'items':[dict(x) for x in lesson['items']],'template':lesson['id'],'source':'prepared','level':level,'topic':lesson['topic']}
    # Reuse a valid prepared item for a due word rather than inventing its translation.
    all_items=[w for l in CURRICULUM['lessons'] if l['level']==level for w in l['items']]
    due_targets=[r['word'] for r in ctx['reviewWords']]
    review=[w for w in all_items if w['target'].lower() in due_targets and w['target'].lower() not in [i['target'].lower() for i in data['items'][1:]]]
    if review:
        data['items'][0]=dict(review[0]);data['intro']='Pehle ek familiar word ko phir dekhenge, phir naye words try karenge.'
    return data

def create_adventure(user,data):
    adventure_id=secrets.token_hex(12)
    profile=json.loads(user['profile'])
    data={**data,'id':adventure_id,'stages':steps(profile)}
    for i,item in enumerate(data['items']):
        item['id']=adventure_id+'-'+str(i)
        opts=[{'text':item['hi']},*({'text':x} for x in item['wrong'])]
        random.SystemRandom().shuffle(opts)
        item['options']=opts
    progress={'index':0,'stage':data['stages'][0],'attempts':0}
    with db() as conn:
        if profile['level']!=data['level']:
            profile['level']=data['level']
            conn.execute('UPDATE users SET profile=? WHERE id=?',(dumps(profile),user['id']))
        conn.execute('INSERT INTO adventures VALUES(?,?,?,?,?,?)',(adventure_id,user['id'],dumps(data),dumps(progress),None,time.time()))
    return {'data':data,'progress':progress,'completed':False}

def active_adventure(user_id):
    with db() as conn:
        row=conn.execute('SELECT * FROM adventures WHERE user_id=? AND completed_at IS NULL ORDER BY created_at DESC LIMIT 1',(user_id,)).fetchone()
    return public_adventure(row) if row else None

def public_adventure(row):
    return {'data':json.loads(row['data']),'progress':json.loads(row['progress']),'completed':row['completed_at'] is not None}

def answer(user,adventure_id,event_id,stage,value,assisted=False,grade=None,expected_index=None):
    with db() as conn:
        conn.execute('BEGIN IMMEDIATE')
        existing=conn.execute('SELECT response FROM events WHERE id=? AND user_id=?',(event_id,user['id'])).fetchone()
        if existing:return json.loads(existing['response'])
        row=conn.execute('SELECT * FROM adventures WHERE id=? AND user_id=?',(adventure_id,user['id'])).fetchone()
        if not row: raise ValueError('Adventure not found.')
        data=json.loads(row['data']);progress=json.loads(row['progress'])
        if row['completed_at']:raise ValueError('This adventure is already complete.')
        if progress['stage']!=stage or expected_index is not None and progress['index']!=expected_index:raise ValueError('Your lesson moved ahead. Refresh to continue from the saved place.')
        item=data['items'][progress['index']]
        correct=False;feedback=''
        if stage=='listen':correct=value is True;feedback='Suno aur phir saath padho. Agla step ready hai.'
        elif stage=='read':
            correct=value is True if assisted else isinstance(value,str) and normal(value)==normal(item['text'])
            feedback='Read-aloud practice complete. Aaram se aage badho.' if correct else 'Mic ne alag words sune. Dobara suno, ya saath padhkar confirm karo.'
        elif stage=='type':correct=isinstance(value,str) and normal(value)==normal(item['target']);feedback='Sahi spelling! Ab meaning samajhte hain.' if correct else 'Achhi koshish. Word dekho, sounds bolo, aur dobara try karo.'
        elif stage=='meaning':
            if grade is not None:correct=grade['correct'];feedback=grade['feedback']
            else:correct=isinstance(value,str) and value==item['hi'];feedback='Bilkul sahi. Ab apne words mein bhi matlab bolo.' if correct else 'Ek baar phir socho. Hindi options sun sakte ho.'
        elif stage=='recap':correct=True;feedback='Ek aur chhoti jeet!'
        else:raise ValueError('Unknown activity.')
        if type(correct) is not bool:correct=False
        if stage not in ('recap',):
            word=item['target'].lower();now=time.time()
            old=conn.execute('SELECT * FROM skills WHERE user_id=? AND word=? AND stage=?',(user['id'],word,stage)).fetchone()
            streak=(old['streak'] if old else 0)+1 if correct and not assisted else 0
            delay=(86400,3*86400,7*86400)[min(max(streak-1,0),2)] if correct and not assisted else 900
            conn.execute('INSERT INTO skills VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,word,stage) DO UPDATE SET english=excluded.english,hindi=excluded.hindi,roman=excluded.roman,attempts=skills.attempts+1,successes=skills.successes+excluded.successes,streak=excluded.streak,due_at=excluded.due_at',(user['id'],word,item['text'],item['hi'],item['roman'],stage,1,int(correct),streak,now+delay))
        complete=False
        if correct:
            idx=data['stages'].index(stage)
            if idx==len(data['stages'])-1:
                if progress['index']==len(data['items'])-1:
                    complete=True;conn.execute('UPDATE adventures SET completed_at=? WHERE id=?',(time.time(),adventure_id))
                else:progress={'index':progress['index']+1,'stage':data['stages'][0],'attempts':0}
            else:progress={'index':progress['index'],'stage':data['stages'][idx+1],'attempts':0}
        else:progress['attempts']+=1
        conn.execute('UPDATE adventures SET progress=? WHERE id=?',(dumps(progress),adventure_id))
        result={'correct':correct,'feedback':feedback,'adventure':{'data':data,'progress':progress,'completed':complete}}
        conn.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)',(event_id,user['id'],adventure_id,stage,int(correct),int(assisted),item['target'].lower(),time.time(),dumps(result)))
        return result

def word_collection(user_id):
    with db() as conn:
        rows=conn.execute("SELECT word,english,hindi,roman,sum(attempts) attempts,sum(successes) successes,coalesce(min(CASE WHEN stage IN ('type','meaning') THEN due_at END),min(due_at)) due_at FROM skills WHERE user_id=? GROUP BY word ORDER BY due_at",(user_id,)).fetchall()
        return [dict(r) for r in rows]
