#!/bin/bash
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir')
PERCENT_USED=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
PERCENT_INT=$(printf '%.0f' "$PERCENT_USED")

echo "$(basename "$CURRENT_DIR")  $MODEL [ctx: ${PERCENT_INT}%]"
