"""
OBJECTIVE: Validates repository files against Rule 5 (Strict No Emojis).
USAGE: python scripts/audit/check_no_emojis.py [--dir .]
PARAMETERS:
    --dir: Base directory to scan (default: current directory)
OUTPUTS: Clean exit code 0 if no emojis found; exit code 1 with line details if emojis detected.
"""

import argparse
import os
import re
import sys

# Ensure UTF-8 output even on legacy Windows console
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

# Targeted regex for actual unicode emoji ranges (excluding box-drawing and standard symbols)
EMOJI_PATTERN = re.compile(
    r"["
    r"\U0001F600-\U0001F64F"  # Emoticons
    r"\U0001F300-\U0001F5FF"  # Misc Symbols and Pictographs
    r"\U0001F680-\U0001F6FF"  # Transport and Map Symbols
    r"\U0001F1E6-\U0001F1FF"  # Regional Indicator Symbols (Flags)
    r"\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    r"\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    r"\U00002700-\U000027BF"  # Dingbats (emoji subset)
    r"]",
    re.UNICODE
)

EXCLUDED_DIRS = {".git", ".governanca", "node_modules", ".agents", "artifacts"}
SCANNED_EXTENSIONS = {".html", ".js", ".mjs", ".css", ".json", ".md", ".py", ".bat", ".txt"}

def scan_file(filepath):
    violations = []
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            for line_no, line in enumerate(f, start=1):
                matches = EMOJI_PATTERN.findall(line)
                if matches:
                    violations.append((line_no, matches, line.strip()))
    except Exception as e:
        print(f"[ERROR] Could not read {filepath}: {e}")
    return violations

def main():
    parser = argparse.ArgumentParser(description="Scan repository for emojis (Rule 5 compliance)")
    parser.add_argument("--dir", default=".", help="Directory to scan")
    args = parser.parse_args()

    total_violations = 0
    scanned_count = 0

    for root, dirs, files in os.walk(args.dir):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in SCANNED_EXTENSIONS:
                path = os.path.join(root, f)
                scanned_count += 1
                violations = scan_file(path)
                if violations:
                    print(f"\n[FAIL] Emoji violation in: {path}")
                    for line_no, chars, text in violations:
                        print(f"  Line {line_no}: detected {chars} in: {text[:80]}")
                    total_violations += len(violations)

    print(f"\n[SUMMARY] Scanned {scanned_count} files.")
    if total_violations == 0:
        print("[OK] Rule 5 check passed: Zero emojis found.")
        sys.exit(0)
    else:
        print(f"[FAIL] Rule 5 check failed: {total_violations} emoji instances found.")
        sys.exit(1)

if __name__ == "__main__":
    main()
