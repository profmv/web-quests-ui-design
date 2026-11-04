# Scripts & Harness Registry

This registry catalogues all project automation scripts, development tools, and verification gates. All scripts are categorized, polymorphic, idempotent, and include standardized English docstring headers.

---

## 1. Directory Structure

```text
scripts/
├── audit/                  # Quality assurance and governance checks
│   └── check_no_emojis.py  # Rule 5 validator (strict prohibition of emojis)
├── build/                  # Asset and data compilers
│   └── build_etapas.mjs    # Cryptographic compiler (PBKDF2 + AES-GCM) for Quest locks
├── server/                 # Local development runtime
│   └── serve.py            # Static HTTP server with UTF-8 and anti-caching headers
└── README.md               # Central script registry and documentation (this file)
```

---

## 2. Catalog & Usage Guide

### Category: `server`

#### `scripts/server/serve.py`
- **Objective:** Serves project files over static HTTP with proper MIME types, UTF-8 charset headers, and caching disabled. Necessary because browser `fetch()` blocks `file://` execution.
- **Runtime:** Python 3.x (Zero external dependencies).
- **Usage:**
  ```powershell
  python scripts/server/serve.py [--port 8080] [--no-browser]
  ```
- **Entry point shortcut:**
  `iniciar.bat` at project root runs this script directly.

---

### Category: `audit`

#### `scripts/audit/check_no_emojis.py`
- **Objective:** Enforces compliance with Rule 5 (Strict No Emojis). Scans all HTML, CSS, JS, JSON, Markdown, Python, and Batch files for unicode emojis and pictograms.
- **Runtime:** Python 3.x (Zero external dependencies).
- **Usage:**
  ```powershell
  python scripts/audit/check_no_emojis.py [--dir .]
  ```
- **Exit codes:** Returns `0` on clean pass; `1` on detection with exact file and line locations.

---

### Category: `build`

#### `scripts/build/build_etapas.mjs`
- **Objective:** Encrypts the quest locks with AES-256-GCM (PBKDF2-SHA-256, 150,000 iterations). Lock N opens with the normalized answer of lock N-1. Also hashes the predictable mistakes of each lock (salted SHA-256, targeted messages), writes the teacher verification file and an encrypted backup of the source.
- **Runtime:** Node.js v18+ (native `webcrypto`).
- **Usage:**
  ```bash
  node scripts/build/build_etapas.mjs --placar-senha "<teacher passphrase>"
  ```
  ```bash
  node scripts/build/build_etapas.mjs --restaurar --placar-senha "<teacher passphrase>"
  ```
  The passphrase may also come from the `PLACAR_SENHA` environment variable. Without it, only `quest/etapas.json` is rebuilt.
- **Outputs:** `quest/etapas.json` (public, encrypted locks), `quest/placar/verificacao.json` (answers encrypted with the teacher passphrase, PBKDF2 600,000 iterations), `scripts/build/etapas.source.enc.json` (encrypted copy of the source).
- **Checks:** fails with exit 1 when a briefing plus tasks exceeds 120 words, when a predictable mistake equals the answer, or when a glossary key is missing.
- **Source custody:** `quest/etapas.source.mjs` holds every answer in plain text and is gitignored (public repository). After a fresh clone or a `git pull`, restore it from the encrypted backup with the `--restaurar` command above. Normalization (accents, case, "px", punctuation ignored) must stay identical in `quest/assets/js/crypto.js`.

---

## 3. Governance Graph Registration (FATO)

Every utility registered here is represented as a `FATO` node in `.governanca/grafo.db` per Rule 11.
