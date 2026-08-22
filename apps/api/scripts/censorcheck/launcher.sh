#!/usr/bin/env bash
# VPS Tracker launcher for vernette/censorcheck (vendor pin 12c5839).
# Fetched via: curl -fsSL https://vt.shnt.top/cc | bash
set -euo pipefail

VT_API_URL="${VT_API_URL:-__VT_API_URL__}"
VT_INGEST_TOKEN="${VT_INGEST_TOKEN:-__VT_INGEST_TOKEN__}"
LAUNCHER_VERSION="1"
VENDOR_SHA="12c5839"

trap 'exit 130' INT

log() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Нужна команда '$1' (установите пакет и повторите)."
}

require_cmd curl
require_cmd jq
require_cmd bash

detect_public_ip() {
  local ip=""
  ip="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
  if [ -z "$ip" ]; then
    ip="$(curl -fsS --max-time 8 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
  fi
  if [ -z "$ip" ] && command -v dig >/dev/null 2>&1; then
    ip="$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null | tr -d '[:space:]' || true)"
  fi
  printf '%s' "$ip"
}

write_vendor() {
  local dest="$1"
  if [ -n "${CENSORCHECK_VENDOR_B64:-}" ]; then
    printf '%s' "$CENSORCHECK_VENDOR_B64" | base64 -d >"$dest" 2>/dev/null \
      || printf '%s' "$CENSORCHECK_VENDOR_B64" | base64 -D >"$dest"
    return 0
  fi
  curl -fsSL --max-time 30 "${VT_API_URL}/cc/vendor" -o "$dest"
}

uuid4() {
  if [ -r /proc/sys/kernel/random/uuid ]; then
    tr -d '[:space:]' </proc/sys/kernel/random/uuid
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import uuid; print(uuid.uuid4())'
    return
  fi
  openssl rand -hex 16
}

VT_API_URL="${VT_API_URL%/}"
[ -n "$VT_API_URL" ] || die "VT_API_URL пуст"
[ -n "$VT_INGEST_TOKEN" ] || die "VT_INGEST_TOKEN пуст"

TMPDIR="$(mktemp -d /tmp/vt-censorcheck.XXXXXX)"
cleanup() { rm -rf "$TMPDIR"; }
trap 'cleanup; exit 130' INT
trap 'cleanup' EXIT

VENDOR="$TMPDIR/censorcheck.sh"
write_vendor "$VENDOR"
chmod +x "$VENDOR"

PUBLIC_IP="$(detect_public_ip)"
[ -n "$PUBLIC_IP" ] || die "Не удалось определить публичный IP"

RUN_ID="$(uuid4)"
[ -n "$RUN_ID" ] || die "Не удалось сгенерировать runId"

log "censorcheck launcher ${LAUNCHER_VERSION} (vendor ${VENDOR_SHA})"
log "probe IP: ${PUBLIC_IP}"
log "runId: ${RUN_ID}"

set +e
RAW_JSON="$(bash "$VENDOR" --mode both --json --no-header --no-dns 2>/tmp/vt-censorcheck-err.$$)"
CC_EXIT=$?
set -e
if [ "$CC_EXIT" -ne 0 ]; then
  log "censorcheck завершился с кодом ${CC_EXIT}" >&2
  if [ -s /tmp/vt-censorcheck-err.$$ ]; then
    cat /tmp/vt-censorcheck-err.$$ >&2 || true
  fi
  rm -f /tmp/vt-censorcheck-err.$$
  exit 1
fi
rm -f /tmp/vt-censorcheck-err.$$

PAYLOAD="$TMPDIR/payload.json"
printf '%s' "$RAW_JSON" | jq --arg runId "$RUN_ID" --arg ip "$PUBLIC_IP" --arg lv "$LAUNCHER_VERSION" '
  {
    schemaVersion: 1,
    runId: $runId,
    probe: { publicIp: $ip },
    launcherVersion: $lv,
    censorcheck: {
      version: ((.version | tostring) // "1"),
      mode: "both"
    },
    results: ((.results // []) | map({
      service: .service,
      raw: .
    }))
  }
' >"$PAYLOAD"

FALLBACK="/tmp/vt-censorcheck-${RUN_ID}.json"
set +e
RESP="$(curl -fsS --max-time 60 -X POST "${VT_API_URL}/api/integrations/censorcheck/runs" \
  -H "Authorization: Bearer ${VT_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @"$PAYLOAD")"
POST_EXIT=$?
set -e

if [ "$POST_EXIT" -ne 0 ]; then
  cp "$PAYLOAD" "$FALLBACK"
  log "API недоступен (curl exit ${POST_EXIT}). JSON сохранён: ${FALLBACK}" >&2
  exit 2
fi

CHECK_ID="$(printf '%s' "$RESP" | jq -r '.id // empty')"
MATCHED="$(printf '%s' "$RESP" | jq -r '.matchedVpsId // "unmatched"')"
if [ -z "$CHECK_ID" ]; then
  cp "$PAYLOAD" "$FALLBACK"
  log "Некорректный ответ API. JSON сохранён: ${FALLBACK}" >&2
  log "$RESP" >&2
  exit 2
fi

log "Check ID: ${CHECK_ID}"
log "VPS: ${MATCHED}"
exit 0
