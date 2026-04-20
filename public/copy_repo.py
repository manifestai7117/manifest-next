from __future__ import annotations

import os
from pathlib import Path
from datetime import datetime

# -----------------------------
# CONFIG
# -----------------------------
PROJECT_ROOT = Path(r"C:\Users\ParikH01\Downloads\manifest-next")
OUTPUT_FILE = PROJECT_ROOT / "project_knowledge_transfer.txt"

# Folders to skip because they are usually huge/generated/noisy
SKIP_DIRS = {
    "node_modules",
    ".next",
    ".git",
    ".idea",
    ".vscode",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    "out",
    "coverage",
    ".turbo",
}

# Files to skip for safety / noise
SKIP_FILE_NAMES = {
    ".DS_Store",
    "Thumbs.db",
}

# Sensitive files you probably do not want to feed into a chatbot
SKIP_FILE_PATTERNS = (
    ".env",
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local",
)

# Extensions that are usually text and useful for project understanding
TEXT_EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx",
    ".json", ".md", ".txt", ".css", ".scss", ".sass",
    ".html", ".htm",
    ".py", ".java", ".c", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt",
    ".sql", ".sh", ".bash", ".zsh", ".ps1",
    ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf",
    ".xml", ".svg",
    ".gitignore", ".npmrc", ".eslintrc", ".prettierrc",
}

# Set to None to include full file contents.
# Set to an integer like 200_000 if you want to cap per-file content size.
MAX_CHARS_PER_FILE = None

# -----------------------------
# HELPERS
# -----------------------------
def should_skip_dir(dir_name: str) -> bool:
    return dir_name in SKIP_DIRS

def should_skip_file(path: Path) -> bool:
    name = path.name
    if name in SKIP_FILE_NAMES:
        return True
    if name in SKIP_FILE_PATTERNS:
        return True
    return False

def is_probably_binary(path: Path, sample_size: int = 8192) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(sample_size)
        if b"\x00" in chunk:
            return True
        # crude heuristic: too many non-text bytes
        text_chars = bytearray({7, 8, 9, 10, 12, 13, 27} | set(range(32, 127)))
        non_text = chunk.translate(None, text_chars)
        return len(non_text) > len(chunk) * 0.30 if chunk else False
    except Exception:
        return True

def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    return not is_probably_binary(path)

def read_text_file(path: Path) -> str:
    encodings = ["utf-8", "utf-8-sig", "cp1252", "latin-1"]
    last_error = None
    for enc in encodings:
        try:
            return path.read_text(encoding=enc)
        except Exception as e:
            last_error = e
    raise last_error

def build_directory_tree(root: Path) -> str:
    lines = [f"{root.name}/"]

    def walk(current: Path, prefix: str = ""):
        try:
            entries = sorted(
                current.iterdir(),
                key=lambda p: (not p.is_dir(), p.name.lower())
            )
        except PermissionError:
            lines.append(prefix + "└── [Permission Denied]")
            return

        visible_entries = []
        for entry in entries:
            if entry.is_dir() and should_skip_dir(entry.name):
                continue
            if entry.is_file() and should_skip_file(entry):
                continue
            visible_entries.append(entry)

        for idx, entry in enumerate(visible_entries):
            is_last = idx == len(visible_entries) - 1
            connector = "└── " if is_last else "├── "
            lines.append(prefix + connector + entry.name)

            if entry.is_dir():
                extension = "    " if is_last else "│   "
                walk(entry, prefix + extension)

    walk(root)
    return "\n".join(lines)

# -----------------------------
# MAIN EXPORT
# -----------------------------
def export_project(root: Path, output_file: Path) -> None:
    if not root.exists():
        raise FileNotFoundError(f"Project root not found: {root}")

    included_files = []
    skipped_binary = []
    skipped_errors = []

    for current_root, dirs, files in os.walk(root):
        # mutate dirs in-place so os.walk skips them
        dirs[:] = [d for d in dirs if not should_skip_dir(d)]

        for file_name in files:
            path = Path(current_root) / file_name

            # skip the output file itself
            if path.resolve() == output_file.resolve():
                continue

            if should_skip_file(path):
                continue

            rel_path = path.relative_to(root)

            if is_text_file(path):
                included_files.append(path)
            else:
                skipped_binary.append(rel_path.as_posix())

    with open(output_file, "w", encoding="utf-8") as out:
        out.write("PROJECT KNOWLEDGE TRANSFER EXPORT\n")
        out.write("=" * 100 + "\n")
        out.write(f"Project root: {root}\n")
        out.write(f"Generated at: {datetime.now().isoformat()}\n")
        out.write(f"Total text files included: {len(included_files)}\n")
        out.write(f"Binary files skipped: {len(skipped_binary)}\n")
        out.write("\n")

        out.write("DIRECTORY TREE\n")
        out.write("=" * 100 + "\n")
        out.write(build_directory_tree(root))
        out.write("\n\n")

        if skipped_binary:
            out.write("BINARY / NON-TEXT FILES SKIPPED\n")
            out.write("=" * 100 + "\n")
            for item in skipped_binary:
                out.write(f"- {item}\n")
            out.write("\n\n")

        out.write("FILE CONTENTS\n")
        out.write("=" * 100 + "\n\n")

        for path in sorted(included_files, key=lambda p: str(p).lower()):
            rel_path = path.relative_to(root).as_posix()

            try:
                content = read_text_file(path)
                if MAX_CHARS_PER_FILE is not None and len(content) > MAX_CHARS_PER_FILE:
                    content = (
                        content[:MAX_CHARS_PER_FILE]
                        + "\n\n[TRUNCATED BY EXPORT SCRIPT DUE TO MAX_CHARS_PER_FILE LIMIT]\n"
                    )

                out.write("=" * 100 + "\n")
                out.write(f"FILE: {rel_path}\n")
                out.write(f"ABSOLUTE_PATH: {path}\n")
                out.write(f"SIZE_BYTES: {path.stat().st_size}\n")
                out.write("=" * 100 + "\n")
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")
                out.write("\n\n")

            except Exception as e:
                skipped_errors.append((rel_path, str(e)))
                out.write("=" * 100 + "\n")
                out.write(f"FILE: {rel_path}\n")
                out.write("STATUS: FAILED TO READ\n")
                out.write(f"ERROR: {e}\n")
                out.write("=" * 100 + "\n\n")

        if skipped_errors:
            out.write("READ ERRORS SUMMARY\n")
            out.write("=" * 100 + "\n")
            for rel_path, err in skipped_errors:
                out.write(f"- {rel_path}: {err}\n")

    print(f"Done. Output written to:\n{output_file}")

if __name__ == "__main__":
    export_project(PROJECT_ROOT, OUTPUT_FILE)