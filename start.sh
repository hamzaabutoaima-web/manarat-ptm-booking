#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${PTM_ADMIN_PASSWORD:?Set PTM_ADMIN_PASSWORD to a strong password at least 12 characters long}"
exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers
