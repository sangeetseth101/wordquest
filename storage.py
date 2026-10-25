"""SQLite persistence, password hashing and server-side sessions."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time

ROOT = Path(__file__).resolve().parent

def load_env():
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

load_env()
DATA_DIR = Path(os.environ.get('WORDQUEST_DATA_DIR', ROOT / 'var'))

def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    conn = sqlite3.connect(DATA_DIR / 'wordquest.sqlite3', timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA journal_mode=WAL')
    return conn

def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

def password_hash(password):
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, maxmem=64*1024*1024)
    return salt + ':' + key.hex()

def password_ok(password, stored):
    try:
        salt, expected = stored.split(':')
        key = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, maxmem=64*1024*1024)
        return hmac.compare_digest(key.hex(), expected)
    except (ValueError, TypeError):
        return False

def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

DEFAULT_PROFILE = {'level':'foundation','interests':['cricket','animals'],'mood':'ready','goal':2,'rate':0.82,'mic':True,'typing':True,'autoVoice':True,'voice':'','hiVoice':'','onboarded':False,'autoLevel':True}

def init_db():
    with db() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,profile TEXT NOT NULL,created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS adventures(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,progress TEXT NOT NULL,completed_at REAL,created_at REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS adventures_user ON adventures(user_id,created_at);
        CREATE TABLE IF NOT EXISTS skills(user_id TEXT NOT NULL REFERENCES users(id),word TEXT NOT NULL,english TEXT NOT NULL,hindi TEXT NOT NULL,roman TEXT NOT NULL,stage TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,successes INTEGER NOT NULL DEFAULT 0,streak INTEGER NOT NULL DEFAULT 0,due_at REAL NOT NULL,PRIMARY KEY(user_id,word,stage));
        CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),adventure_id TEXT NOT NULL,kind TEXT NOT NULL,correct INTEGER,assisted INTEGER NOT NULL DEFAULT 0,word TEXT NOT NULL,created_at REAL NOT NULL,response TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS events_user ON events(user_id,created_at);
        CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,text TEXT NOT NULL,source TEXT NOT NULL,created_at REAL NOT NULL,speech TEXT NOT NULL DEFAULT '',english TEXT NOT NULL DEFAULT '',prompt TEXT NOT NULL DEFAULT '');
        CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,created_at REAL NOT NULL,tokens INTEGER NOT NULL DEFAULT 0,cost REAL NOT NULL DEFAULT 0,status TEXT NOT NULL);
        ''')
        seeds = [
            (os.environ.get('WORDQUEST_SEED_USERNAME','parthlohani'),os.environ.get('WORDQUEST_SEED_NAME','Parth Lohani'),os.environ.get('WORDQUEST_SEED_PASSWORD'), 'learner'),
            (os.environ.get('WORDQUEST_GUARDIAN_USERNAME','guardian'),'Guardian',os.environ.get('WORDQUEST_GUARDIAN_PASSWORD'),'guardian')]
        for username, name, password, role in seeds:
            if password and not conn.execute('SELECT id FROM users WHERE username=?',(username,)).fetchone():
                if len(password)<12 or password.startswith('REPLACE_'):
                    raise RuntimeError('Seed passwords must contain at least 12 characters.')
                conn.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',(secrets.token_hex(12),username.lower(),name,password_hash(password),role,dumps(DEFAULT_PROFILE),time.time()))
        conn.execute('DELETE FROM sessions WHERE expires_at<?',(time.time(),))
    try:
        os.chmod(DATA_DIR / 'wordquest.sqlite3',0o600)
    except OSError:
        pass

def user_public(row):
    return {'id':row['id'],'username':row['username'],'name':row['display_name'],'role':row['role'],'profile':json.loads(row['profile'])}

def get_config():
    with db() as conn:
        return {r['key']:json.loads(r['value']) for r in conn.execute('SELECT * FROM config')}

def set_config(values):
    with db() as conn:
        for key, value in values.items():
            conn.execute('INSERT INTO config VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',(key,dumps(value)))

def api_key():
    key = os.environ.get('OPENROUTER_API_KEY','')
    path = DATA_DIR / 'openrouter.key'
    if path.exists():
        key = path.read_text().strip()
    return key

def save_api_key(key):
    path = DATA_DIR / 'openrouter.key'
    tmp = DATA_DIR / ('.key-'+secrets.token_hex(8))
    fd = os.open(tmp, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
    with os.fdopen(fd,'w') as f:
        f.write(key)
    os.replace(tmp,path)
