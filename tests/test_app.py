import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

os.environ['WORDQUEST_DATA_DIR']=tempfile.mkdtemp(prefix='wordquest-initial-')
os.environ['WORDQUEST_SEED_USERNAME']='parthlohani'
os.environ['WORDQUEST_SEED_PASSWORD']='test-learner-password'
os.environ['WORDQUEST_GUARDIAN_PASSWORD']='test-guardian-password'
os.environ['OPENROUTER_API_KEY']=''
import storage
import learning
import tutor
from app import app, limits

ORIGIN='http://127.0.0.1:4173'

class WordQuestTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='wordquest-test-')
        storage.DATA_DIR=Path(self.tmp.name)
        storage.init_db()
        limits.clear()
        app.testing=True
        self.client=app.test_client()
        self.csrf=None

    def tearDown(self):self.tmp.cleanup()

    def post(self,path,data,client=None,csrf=None):
        return (client or self.client).post('/api'+path,json=data,headers={'Origin':ORIGIN,'X-CSRF-Token':csrf or self.csrf or ''})

    def login(self,guardian=False):
        r=self.post('/login',{'username':'guardian' if guardian else 'parthlohani','password':'test-guardian-password' if guardian else 'test-learner-password'})
        self.assertEqual(r.status_code,200,r.get_json())
        self.csrf=r.get_json()['csrf']
        return r.get_json()

    def create(self):
        r=self.post('/adventures',{'template':'lesson-0'})
        self.assertEqual(r.status_code,201,r.get_json())
        return r.get_json()

    def answer(self,a,value,**kw):
        import uuid
        return self.post('/adventures/'+a['data']['id']+'/answer',{'eventId':str(uuid.uuid4()),'stage':a['progress']['stage'],'itemIndex':a['progress']['index'],'value':value,**kw})

    def test_authentication_and_cookie_security(self):
        self.assertEqual(self.client.get('/api/dashboard').status_code,401)
        wrong=self.post('/login',{'username':'parthlohani','password':'wrong'})
        self.assertEqual(wrong.status_code,401)
        result=self.login()
        self.assertEqual(result['user']['name'],'Parth Lohani')
        self.assertEqual(result['user']['role'],'learner')
        self.assertNotIn('password_hash',result['user'])
        cookie=self.client.get_cookie('wordquest_session')
        self.assertTrue(cookie.http_only)
        self.assertEqual(cookie.same_site,'Strict')
        with storage.db() as db:
            stored=db.execute("SELECT password_hash FROM users WHERE username='parthlohani'").fetchone()[0]
            self.assertNotIn('test-learner-password',stored)
            self.assertTrue(storage.password_ok('test-learner-password',stored))

    def test_csrf_origin_and_guardian_boundaries(self):
        self.login()
        self.assertEqual(self.client.get('/api/guardian').status_code,403)
        self.assertEqual(self.post('/guardian/ai',{'key':'anything'}).status_code,403)
        self.assertEqual(self.client.post('/api/adventures',json={},headers={'Origin':ORIGIN}).status_code,403)
        self.assertEqual(self.client.post('/api/logout',json={},headers={'Origin':'https://evil.example','X-CSRF-Token':self.csrf}).status_code,403)
        for path in ('/.env','/var/wordquest.sqlite3','/assets/../.env','/storage.py'):
            self.assertEqual(self.client.get(path).status_code,404)

    def test_prepared_lesson_retry_completion_and_idempotency(self):
        self.login();a=self.create()
        self.assertEqual(a['progress']['stage'],'listen')
        import uuid
        event={'eventId':str(uuid.uuid4()),'stage':'listen','itemIndex':0,'value':True}
        r=self.post('/adventures/'+a['data']['id']+'/answer',event)
        self.assertEqual(r.status_code,200,r.get_json());a=r.get_json()['adventure']
        replay=self.post('/adventures/'+a['data']['id']+'/answer',event)
        self.assertEqual(replay.get_json()['adventure'],a)
        r=self.answer(a,True,assisted=True);a=r.get_json()['adventure']
        wrong=self.answer(a,'wrong')
        self.assertFalse(wrong.get_json()['correct'])
        self.assertEqual(wrong.get_json()['adventure']['progress']['stage'],'type')
        # Continue all remaining stages, using authoritative server state.
        while not a['completed']:
            stage=a['progress']['stage'];w=a['data']['items'][a['progress']['index']]
            value=w['target'] if stage=='type' else w['hi'] if stage=='meaning' else True
            r=self.answer(a,value,assisted=stage=='read')
            self.assertEqual(r.status_code,200,r.get_json())
            self.assertTrue(r.get_json()['correct'],r.get_json())
            a=r.get_json()['adventure']
        stats=self.client.get('/api/dashboard').get_json()['stats']
        self.assertEqual(stats['completed'],1)
        self.assertEqual(stats['stars'],3)
        self.assertEqual(stats['xp'],120)
        self.assertEqual(stats['meaning'],4)
        self.assertEqual(stats['scoredAttempts'],9)
        self.assertEqual(len(self.client.get('/api/words').get_json()['words']),4)

    def test_progress_persists_and_cross_account_isolation(self):
        self.login();a=self.create();a=self.answer(a,True).get_json()['adventure']
        storage.init_db()
        self.assertEqual(self.client.get('/api/session').get_json()['active']['progress'],a['progress'])
        with storage.db() as db:
            db.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',('other','anotherlearner','Another Learner',storage.password_hash('another-password-123'),'learner',storage.dumps(storage.DEFAULT_PROFILE),0))
        other=app.test_client();r=self.post('/login',{'username':'anotherlearner','password':'another-password-123'},client=other)
        self.assertEqual(r.status_code,200)
        self.assertEqual(other.get('/api/adventures/'+a['data']['id']).status_code,404)
        self.assertIsNone(other.get('/api/session').get_json()['active'])

    def test_stale_item_request_does_not_advance_lesson(self):
        self.login();a=self.create()
        import uuid
        r=self.post('/adventures/'+a['data']['id']+'/answer',{'eventId':str(uuid.uuid4()),'stage':'listen','itemIndex':1,'value':True})
        self.assertEqual(r.status_code,400)
        self.assertEqual(self.client.get('/api/session').get_json()['active']['progress']['index'],0)

    def test_missing_ai_is_explicit_and_practice_is_available(self):
        self.login()
        r=self.post('/adventures',{'mode':'ai'})
        self.assertEqual(r.status_code,503)
        self.assertEqual(r.get_json()['code'],'not_connected')
        r=self.post('/tutor/chat',{'message':'Hello Pip'})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.get_json()['source'],'practice')
        self.assertIn('practice mode',r.get_json()['reply'])
        self.assertEqual(self.post('/adventures',{}).status_code,201)

    def test_hinted_answers_do_not_drive_level_suggestions(self):
        user=self.login()['user'];a=self.create()
        for _ in range(2):a=self.answer(a,True,assisted=True).get_json()['adventure']
        a=self.answer(a,'bag',assisted=True).get_json()['adventure']
        self.answer(a,a['data']['items'][0]['hi'],assisted=True)
        s=self.client.get('/api/dashboard').get_json()['stats']
        self.assertEqual(s['scoredAttempts'],0)
        self.assertIsNone(s['accuracy'])

    def test_guardian_key_stays_private_and_invalid_config_is_atomic(self):
        self.login(True)
        r=self.post('/guardian/ai',{'key':'sk-or-v1-test-private-key','model':'unknown/model','enabled':True})
        self.assertEqual(r.status_code,400)
        self.assertFalse((storage.DATA_DIR/'openrouter.key').exists())
        r=self.post('/guardian/ai',{'key':'sk-or-v1-test-private-key','model':tutor.MODEL,'enabled':True,'dailyLimit':10})
        self.assertEqual(r.status_code,200)
        config=self.client.get('/api/guardian').get_json()
        self.assertTrue(config['ai']['configured'])
        self.assertNotIn('sk-or-',json.dumps(config))
        self.assertEqual((storage.DATA_DIR/'openrouter.key').stat().st_mode & 0o777,0o600)

    def test_openrouter_request_and_structured_response_boundary(self):
        self.login(True)
        self.post('/guardian/ai',{'key':'sk-or-v1-test-private-key','enabled':True,'dailyLimit':10})
        payload={'choices':[{'message':{'content':json.dumps({'message':'Hello! Let us read together.'})}}],'usage':{'total_tokens':20,'cost':0.0001}}
        fake=io.BytesIO(json.dumps(payload).encode())
        with patch('tutor.urllib.request.urlopen',return_value=fake) as call:
            r=self.post('/guardian/ai/test',{})
            self.assertEqual(r.status_code,200,r.get_json())
            request=call.call_args[0][0]
            self.assertEqual(request.full_url,'https://openrouter.ai/api/v1/chat/completions')
            sent=json.loads(request.data)
            self.assertEqual(sent['response_format']['type'],'json_schema')
            self.assertEqual(sent['provider']['data_collection'],'deny')
        self.assertIsNotNone(self.client.get('/api/guardian').get_json()['ai']['testedAt'])

    def test_malformed_and_inappropriate_adventure_is_rejected(self):
        good={'title':'A little school adventure','intro':'Chalo padhein','scene':'School ki cheezein','items':[dict(x) for x in learning.CURRICULUM['lessons'][0]['items']]}
        self.assertEqual(len(tutor.validate_adventure(good,'foundation')['items']),4)
        good['items'][0]['text']='This is far too many words for foundation.'
        with self.assertRaises(tutor.AIError):tutor.validate_adventure(good,'foundation')
        good['items'][0]['text']='weapon'
        with self.assertRaises(tutor.AIError):tutor.validate_adventure(good,'foundation')

    def test_daily_ai_cap_is_reserved_before_provider_call(self):
        user=self.login(True)['user']
        storage.set_config({'daily_limit':10})
        for _ in range(8):tutor.reserve(user['id'],'test')
        with self.assertRaises(tutor.AIError):tutor.reserve(user['id'],'test')

    def test_real_ai_routes_with_mocked_provider_and_private_context(self):
        self.login(True)
        self.post('/guardian/ai',{'key':'sk-or-v1-test-private-key','enabled':True,'dailyLimit':20})
        self.post('/logout',{})
        self.login()
        generated={'title':'A little school adventure','intro':'Chalo padhein','scene':'School ki cheezein','items':[dict(x) for x in learning.CURRICULUM['lessons'][0]['items']]}
        def provider(data):
            return io.BytesIO(json.dumps({'choices':[{'message':{'content':json.dumps(data)}}],'usage':{'total_tokens':50}}).encode())
        with patch('tutor.urllib.request.urlopen',return_value=provider(generated)) as call:
            r=self.post('/adventures',{'mode':'ai'})
            self.assertEqual(r.status_code,201,r.get_json())
            self.assertEqual(r.get_json()['data']['source'],'ai')
            sent=call.call_args[0][0].data.decode()
            self.assertIn('Parth',sent)
            self.assertNotIn('Parth Lohani',sent)
            self.assertNotIn('test-learner-password',sent)
            self.assertNotIn('sk-or-',sent)
        chat={'reply':'Chalo bag padhein.','speak':'चलो bag पढ़ें।','english':'bag','prompt':'Can you read bag?'}
        with patch('tutor.urllib.request.urlopen',return_value=provider(chat)):
            r=self.post('/tutor/chat',{'message':'Can we learn a word?'})
            self.assertEqual(r.status_code,200,r.get_json())
            self.assertEqual(r.get_json()['source'],'ai')
        saved=self.client.get('/api/tutor/messages').get_json()['messages'][-1]
        self.assertEqual(saved['speech'],chat['speak'])
        self.assertEqual(saved['english'],'bag')
        a=r=self.client.get('/api/session').get_json()['active']
        for value,opts in [(True,{}),(True,{'assisted':True}),('bag',{})]:
            r=self.answer(a,value,**opts);self.assertEqual(r.status_code,200,r.get_json());a=r.get_json()['adventure']
        with patch('tutor.urllib.request.urlopen',return_value=provider({'correct':True,'feedback':'Haan, matlab samajh aaya.'})):
            r=self.answer(a,'School ka basta',freeText=True)
            self.assertTrue(r.get_json()['correct'],r.get_json())

    def test_level_changes_need_evidence_at_each_new_level(self):
        user=self.login()['user']
        import time,uuid
        with storage.db() as db:
            row=db.execute('SELECT * FROM users WHERE id=?',(user['id'],)).fetchone()
        for n in range(3):
            a=learning.create_adventure(row,learning.prepared(row))
            with storage.db() as db:
                db.execute('UPDATE adventures SET completed_at=? WHERE id=?',(time.time(),a['data']['id']))
                for i in range(4):
                    db.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)',(str(uuid.uuid4()),user['id'],a['data']['id'],'type',1,0,'word',time.time(),'{}'))
        self.assertEqual(learning.recommendation(row)['level'],'basic')
        chosen=learning.prepared(row)
        self.assertEqual(chosen['level'],'basic')
        learning.create_adventure(row,chosen)
        with storage.db() as db:updated=db.execute('SELECT * FROM users WHERE id=?',(user['id'],)).fetchone()
        self.assertEqual(json.loads(updated['profile'])['level'],'basic')
        self.assertEqual(learning.recommendation(updated)['level'],'basic')

    def test_password_change_revokes_learner_sessions(self):
        learner=self.login()['user'];other=app.test_client()
        auth=self.post('/login',{'username':'guardian','password':'test-guardian-password'},client=other).get_json()
        r=self.post('/guardian/password',{'userId':learner['id'],'currentPassword':'test-guardian-password','password':'new-learner-password'},client=other,csrf=auth['csrf'])
        self.assertEqual(r.status_code,200)
        self.assertEqual(self.client.get('/api/dashboard').status_code,401)
        self.assertEqual(self.post('/login',{'username':'parthlohani','password':'new-learner-password'}).status_code,200)

if __name__=='__main__':unittest.main()
