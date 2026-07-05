# CLAUDE.md

## Project Overview

This project is a web application with a Flask backend and an HTML/CSS/JS frontend.
Claude assists as a coding partner with strict adherence to the principles below.

---

## Stack

- **Backend**: Python 3, Flask
- **Frontend**: HTML (semantic), CSS (modular), JavaScript (ES6+ modules)
- **Template engine**: Jinja2 (Flask default)

---

## Project Structure (Canonical)

```
Staff Mind/
├── config/
│   ├── .env                    # Environment variables (never committed)
│   └── .env.example            # Committed template with all keys, no values
├── data/                       # Data files (CSVs, JSONs, SQLite, etc.)
├── docs/                       # Project documentation and reference material
├── src/
│   ├── routes/                 # Flask blueprints — one file per domain
│   ├── services/               # Business logic — no Flask imports here
│   ├── models/                 # Data models / schema definitions
│   ├── utils/                  # Shared pure-Python utilities
│   ├── static/
│   │   ├── css/                # One CSS file per component or feature
│   │   ├── js/                 # One JS module per domain concern
│   │   └── assets/             # Images, fonts, icons
│   └── templates/              # Jinja2 templates; partials in templates/partials/
├── tests/                      # Flat: one test file per source module (e.g., tests/test_user_service.py)
├── main.py                     # App entry point — wiring only, no logic
└── requirements.txt            # Pinned Python dependencies
```

---

## Architecture Principles

### Modularity

- **Python**: one module per domain concern; no logic in `main.py` beyond app wiring
- **CSS**: one stylesheet per component/feature (e.g., `nav.css`, `modal.css`)
- **JS**: one module per concern (e.g., `api.js`, `renderer.js`, `formValidator.js`)
- No monolithic files; entry-point files import only — they do not implement

### Separation of Concerns

| Layer | Responsibility |
|---|---|
| `src/routes/` | HTTP request/response wiring only — delegates to `services/` |
| `src/services/` | Business logic — no Flask, no HTTP concepts |
| `src/models/` | Data structure definitions only |
| `src/utils/` | Pure, stateless helper functions |
| `src/static/js/` | UI behavior — no business logic |
| `src/static/css/` | Presentation — no layout logic in HTML |

### Encapsulation

- Each Python module exposes only what is necessary; internals are prefixed `_`
- Each JS module exports only its public API; DOM access is confined to the owning module
- No cross-module side effects; communicate via function calls or custom events
- No global variables or constants anywhere in the codebase
- All configuration values are encapsulated in `src/config.py`; access them via explicit import, never via `os.environ` or inline literals

### Single Responsibility per Function

- Every function does exactly one thing
- If a function needs a second verb, split it
- Target: ≤ 20 lines per function; flag and refactor if exceeded

### No Code Smells — Enforce Strictly

- **No duplication**: extract any logic used more than once into a shared utility
- **No long methods**: refactor if a function scrolls past one screen
- **No large classes/modules**: split by responsibility; prefer composition

---

## Configuration

- All environment variables are defined in `config/.env` (local only, git-ignored)
- `config/.env.example` is the committed reference — one key per line, no values
- `src/config.py` is the sole file that reads from `config/.env` via `python-dotenv`; all other modules import from `src/config.py`, never from `os.environ` directly

**Every new config value follows this flow:**

1. Add key to `config/.env` (with real value)
2. Add key to `config/.env.example` (with empty value)
3. Add typed constant to `src/config.py`
4. Import the constant where needed — never `os.environ` directly

---

## Documentation Standards

### Python

Every module, class, and function must have a docstring:

```python
"""
src/services/user_service.py

Handles all user-related business logic: creation, lookup, and deactivation.
Does NOT handle authentication — see auth_service.py.
"""

def get_user_by_id(user_id: int) -> dict | None:
    """
    Retrieve a single user record by primary key.

    Args:
        user_id (int): The user's primary key.

    Returns:
        dict | None: User data dict, or None if not found.
    """
```

### JavaScript

Every function and class must have a JSDoc block:

```js
/**
 * @module formValidator
 * @description Validates form inputs client-side before submission.
 * Does NOT submit the form — see api.js for fetch calls.
 */

/**
 * Validates that a required field is non-empty.
 *
 * @param {HTMLInputElement} input - The input element to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
function validateRequired(input) { ... }
```

### CSS

Each file starts with a section header:

```css
/* ============================================================
   modal.css — Modal dialog styles: overlay, container, close button.
   Does NOT include modal content styles — see forms.css.
   ============================================================ */
```

### HTML / Jinja2

- Use semantic elements throughout
- Comment non-obvious structural decisions inline
- No inline `style=""` or `onclick=""` attributes

---

## File Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Python modules | `snake_case.py` | `user_service.py` |
| Flask blueprints | `snake_case.py` | `auth_routes.py` |
| JS modules | `camelCase.js` | `formValidator.js` |
| CSS files | `kebab-case.css` | `user-card.css` |
| HTML templates | `kebab-case.html` | `user-profile.html` |

---

## What Claude Must Not Do

- Do not put business logic in route handlers — delegate to `services/`
- Do not put Flask/HTTP imports in `services/` or `utils/`
- Do not add styles to HTML files (`style=""` or `<style>` blocks)
- Do not add logic to HTML files (`onclick=""` or `<script>` blocks, except the root entry point)
- Do not produce undocumented functions, classes, or modules
- Do not duplicate logic that already exists — ask first
- Do not declare global variables or constants anywhere in the code
- Do not use module-level constants as substitutes for globals — all values must be encapsulated in `src/config.py` and accessed via import
- Do not hardcode magic numbers, strings, or flags inline — they belong in `config/.env` → `src/config.py`
- Do not hardcode configuration values (URLs, keys, ports, flags) — all go in `config/.env`
- Do not commit `config/.env` — always verify `.gitignore` includes it
- When adding a new env variable, add the key (with empty value) to `config/.env.example` immediately
- Do not import a Python library without adding it to `requirements.txt` in the same response
- Do not leave dependencies unpinned

---

## Living Documents

### README.md

Claude must keep `README.md` current after every change that affects it.

**README.md must always contain these sections:**

- **What it does** — one-paragraph description of the project's purpose
- **Stack** — languages, frameworks, and dependencies with versions when known
- **File structure** — directory tree with one-line description per entry
- **How to run** — step-by-step local setup: install dependencies, environment variables, start command

**Rules:**

- Update README.md in the same response as the code change — never defer it
- Do not summarize changes vaguely; be specific (e.g., "Added `auth_service.py`: handles login and token validation")
- If a change makes an existing README section inaccurate, correct it immediately

### requirements.txt

- Must be kept current at all times
- Add a new library to `requirements.txt` immediately when it is imported anywhere in the codebase
- Never import a library without first confirming it is listed in `requirements.txt`
- Pin versions (e.g., `flask==3.1.0`) — no unpinned dependencies

### Tests

- All tests live flat in `tests/`, one file per source module (e.g., `tests/test_user_service.py`)
- Follow TDD: write the test first, then implement the function to pass it
- Every new function in `services/` and `utils/` must have a corresponding test
- Claude must create or update the relevant test file in the same response as the implementation

---

## Before Writing Any Code

1. Identify which existing module owns this concern
2. Check for existing utilities before writing new ones
3. If a new module is needed, state its name, layer, and single responsibility before implementing
4. Keep changes scoped — do not refactor adjacent code unless explicitly asked

---

## When in Doubt

Ask. Do not assume, infer, or fill gaps silently.
