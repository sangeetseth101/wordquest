# WordQuest

A personalised English reading app with Hindi/Hinglish guidance, a conversational AI coach named Pip, adaptive adventures, and separate learner and guardian accounts.

## What works

- Password-protected learner and guardian accounts; salted scrypt hashes and server-side sessions.
- First-session interests and starting level; persistent learning history in SQLite.
- Spoken tutor replies, push-to-talk input and editable transcripts using browser speech features.
- OpenRouter-backed conversations, fresh four-item adventures, and assessment of meanings expressed in the learner’s own words.
- Five reading levels, 20 prepared lessons and 80 prepared word/sentence activities.
- Listening, reading aloud, spelling, meaning and review activities, with optional speaking/typing.
- Server-validated attempts, retry feedback, idempotent submissions, account-isolated progress, XP, stars and daily goals.
- Review scheduling: unsuccessful or assisted attempts return sooner; successful unassisted attempts are revisited after 1, 3 and 7 days.
- Level suggestions use recent unassisted spelling and meaning answers at the current level. Self-reported reading and microphone transcripts do not drive promotion.
- Guardian-only key configuration, real provider connection test, usage and learner evidence.
- Explicit prepared-practice mode when AI is not connected. It does not impersonate live AI.

## Run locally

Requires Python 3.12+ (or Docker).

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
cp .env.example .env
```

Edit `.env` with unique learner and guardian passwords of at least 12 characters. Then:

```sh
.venv/bin/python app.py
```

Open **http://127.0.0.1:4173**. The initial accounts are seeded on first start. Password changes in `.env` do not replace an existing account’s password; use Guardian controls for that.

The local installation prepared during development already has the requested Parth Lohani account. Actual passwords, session data and the database are deliberately excluded from this repository.

## Connect real AI

1. Sign in with the guardian account.
2. Add an OpenRouter API key under Guardian controls (or set `OPENROUTER_API_KEY` on the server).
3. Choose a model and enable AI. Merely setting an environment key does not opt the learner into AI; enable it in Guardian controls.
4. Save, then click **Test a real AI response**.
5. Sign back into the learner account. Fresh adventures, open conversation and free-text meaning assessment are now enabled.

The default model is `openai/gpt-4.1-mini`; the request uses OpenRouter’s JSON schema response format and requires supported parameters. Provider errors, invalid keys, insufficient credits, timeouts and malformed lesson content produce explicit errors. Prepared practice remains usable.

AI receives the learner’s first name, chosen interests/mood, recent learning evidence and up to 12 recent conversation messages. Full name, account password, API key and recordings are not included in model requests. Provider routing requests `data_collection: deny`; this preference is not a promise about all third-party retention. The app retains at most 200 text chat messages per learner.

Browser speech synthesis is device dependent. Microphone transcription may use the browser’s online service; WordQuest does not save recordings. Transcript matching is **not** a pronunciation assessment. Live mic and genuine model quality require testing on the learner’s device with a connected API key.

## Tests

```sh
.venv/bin/python -m unittest discover -s tests -v
node --check public/app.js
```

Backend tests cover login and cookies, CSRF/origin checks, guardian permissions, private-file denial, cross-account isolation, persisted progress, idempotent attempts, stale item rejection, complete lesson progression, hints and level evidence, key confidentiality, provider request/response handling, invalid generated content, usage limits and password/session revocation. Model responses are mocked in automated tests; they do not prove a live provider connection.

## Hosting

### Docker

```sh
docker compose up -d --build
```

The app is exposed on this machine’s loopback interface at port 4173. SQLite, keys and sessions persist in the `wordquest-data` volume. Back up that volume securely. The image uses Gunicorn, not Flask’s development server.

### Public HTTPS deployment

A `render.yaml` blueprint is included for a Docker service with a persistent disk. This provisions paid hosting; deployment is an explicit operator action. Set `APP_ORIGIN` to the exact HTTPS origin assigned to the service, and configure seed passwords as private environment variables before first start. OpenRouter can be configured in Guardian controls afterward. Production cookies become `Secure` automatically when `APP_ORIGIN` uses HTTPS.

The process listens on port 4173. Keep `WORDQUEST_DATA_DIR=/data` on a persistent volume. A single instance with one worker/four threads is the supported SQLite deployment; use a shared database and shared rate limiter before scaling to multiple instances. Configure HTTPS at the hosting layer. For another platform, deploy the Dockerfile with a persistent `/data` volume and the same environment variables.

GitHub Pages is not supported: account authentication and AI requests require a backend. Pushing to GitHub alone does not deploy the server. No public deployment is created automatically and no hosting account is charged by this repository.

## Main files

- `app.py`: authenticated API and static frontend hosting.
- `storage.py`: SQLite schema, password hashes, sessions and private server key.
- `learning.py`: lesson progression, evidence, review scheduling and level suggestions.
- `tutor.py`: OpenRouter boundary, context, structured schemas and validation.
- `public/`: responsive learner and guardian interface.
- `curriculum.json`: prepared curriculum used by the backend.
- `tests/`: integration tests with isolated temporary databases.

## Operational limits

The tutor provides educational support, not diagnosis or guaranteed learning outcomes. Generated content is constrained and validated, but model quality still needs adult review. Accounts are provisioned by server configuration; public self-registration is intentionally absent. Forgotten guardian credentials require an operator-managed reset. Data deletion/retention policy, monitoring, backups and a deployment review are needed before offering this beyond a private family installation.
