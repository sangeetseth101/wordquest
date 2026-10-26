"""SQLite/PostgreSQL persistence, password hashing and server-side sessions."""
import hashlib
import hmac
import json
import os
import re
from contextlib import contextmanager
from urllib.parse import urlparse
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

class StorageSetupError(Exception):
    """Safe configuration message; never contains a connection string."""


def database_url():
    return os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or ''


def serverless():
    return os.environ.get('VERCEL') == '1'


def postgres_sql(statement):
    """Translate the small set of SQLite expressions used by this application."""
    statement = statement.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'BIGSERIAL PRIMARY KEY')
    statement = re.sub(r'\bREAL\b', 'DOUBLE PRECISION', statement)
    statement = statement.replace("date(completed_at,'unixepoch','+5 hours','+30 minutes')", "to_char(to_timestamp(completed_at) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')")
    statement = re.sub(r"json_extract\((adventures\.)?data,'\$\.level'\)", lambda m: '(' + (m.group(1) or '') + "data::jsonb ->> 'level')", statement)
    # Every statement is application-owned. Bound values are never interpolated.
    return statement.replace('?', '%s')


class NamedRow(dict):
    def __getitem__(self, key):
        return tuple(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


class PostgresConnection:
    def __init__(self, conn):
        self.conn = conn

    def execute(self, statement, params=()):
        if statement.strip().upper() == 'BEGIN IMMEDIATE':
            # Serialize read/modify/write attempts and usage reservations across instances.
            return self.conn.execute('SELECT pg_advisory_xact_lock(1464947537)')
        return self.conn.execute(postgres_sql(statement), params)

    def executescript(self, script):
        self.conn.execute('SELECT pg_advisory_xact_lock(1464947537)')
        for statement in script.split(';'):
            if statement.strip():
                self.execute(statement)


@contextmanager
def db():
    url = database_url()
    if url:
        import psycopg
        settings = {'connect_timeout': 10, 'row_factory': lambda cursor: lambda values: NamedRow(zip([c.name for c in cursor.description], values))}
        # Cloud connections must be encrypted; local test servers can use Unix sockets.
        if urlparse(url).hostname not in ('localhost', '127.0.0.1', None):
            settings['sslmode'] = 'require'
        with psycopg.connect(url, **settings) as conn:
            yield PostgresConnection(conn)
        return
    if serverless():
        raise StorageSetupError('Account storage is not connected. Configure DATABASE_URL with a hosted PostgreSQL database in Vercel. Local SQLite cannot persist accounts on this host.')
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    conn = sqlite3.connect(DATA_DIR / 'wordquest.sqlite3', timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA journal_mode=WAL')
    try:
        with conn:
            yield conn
    finally:
        conn.close()

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
        if serverless():
            roles={r['role'] for r in conn.execute('SELECT role FROM users')}
            missing=[]
            if 'learner' not in roles:missing.append('WORDQUEST_SEED_PASSWORD')
            if 'guardian' not in roles:missing.append('WORDQUEST_GUARDIAN_PASSWORD')
            if missing:raise StorageSetupError('Create the initial accounts by setting '+', '.join(missing)+' in Vercel, then redeploy. Use passwords of at least 12 characters.')
        conn.execute('DELETE FROM sessions WHERE expires_at<?',(time.time(),))
    try:
        if database_url():return
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
    if not serverless() and path.exists():
        key = path.read_text().strip()
    return key

def save_api_key(key):
    if serverless():
        raise ValueError('Set OPENROUTER_API_KEY in Vercel Environment Variables, then redeploy. This host manages API secrets through its environment.')
    path = DATA_DIR / 'openrouter.key'
    tmp = DATA_DIR / ('.key-'+secrets.token_hex(8))
    fd = os.open(tmp, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
    with os.fdopen(fd,'w') as f:
        f.write(key)
    os.replace(tmp,path)
