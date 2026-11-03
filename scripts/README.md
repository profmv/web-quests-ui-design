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
- **Objective:** Encrypts quest locks using AES-256-GCM derived via PBKDF2 (150,000 iterations) with SHA-256. Lock $N$ requires the normalized answer of Lock $N-1$ as password.
- **Runtime:** Node.js v18+ (uses native `webcrypto`).
- **Usage:**
  ```powershell
  node scripts/build/build_etapas.mjs [--source quest/etapas.source.mjs] [--out quest/etapas.json]
  ```
- **Output:** Encrypted `etapas.json` consumed by the student browser client.

---

## 3. Governance Graph Registration (FATO)

Every utility registered here is represented as a `FATO` node in `.governanca/grafo.db` per Rule 11.
