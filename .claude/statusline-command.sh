#!/bin/bash
exec python3 <(cat <<'PY'
import json, os, sys

try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

model = (data.get("model") or {}).get("display_name") or "?"
cwd = (data.get("workspace") or {}).get("current_dir") or data.get("cwd") or "."
transcript = data.get("transcript_path") or ""

tokens = 0
if transcript and os.path.isfile(transcript):
    try:
        with open(transcript, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                usage = ((obj.get("message") or {}).get("usage")) or obj.get("usage")
                if usage:
                    t = (
                        (usage.get("input_tokens") or 0)
                        + (usage.get("cache_read_input_tokens") or 0)
                        + (usage.get("cache_creation_input_tokens") or 0)
                        + (usage.get("output_tokens") or 0)
                    )
                    if t:
                        tokens = t
    except Exception:
        pass

pct = int(tokens * 100 / 200000) if tokens else 0
print(f"{os.path.basename(cwd.rstrip('/'))}  {model} [ctx: {pct}%]")
PY
)
