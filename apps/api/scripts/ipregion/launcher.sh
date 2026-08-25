#!/usr/bin/env bash
# VPS Tracker launcher for vernette/ipregion (vendor pin 7d1c25c).
# Fetched via: curl -fsSL https://vt.shnt.top/ic | bash
set -euo pipefail

VT_API_URL="${VT_API_URL:-__VT_API_URL__}"
VT_INGEST_TOKEN="${VT_INGEST_TOKEN:-__VT_INGEST_TOKEN__}"
LAUNCHER_VERSION="2"
VENDOR_SHA="7d1c25c"
DAILY_SLUG="vt-ipregion"
DAILY_PATH="/ic"

OS_ID="unknown"
OS_LIKE=""
OS_NAME="unknown"

trap 'exit 130' INT

log() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Нужна команда '$1' (установите пакет и повторите)."
}

detect_os() {
  OS_ID="unknown"
  OS_LIKE=""
  OS_NAME="unknown"
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_LIKE="${ID_LIKE:-}"
    OS_NAME="${PRETTY_NAME:-$OS_ID}"
  fi
}

detect_pkg_manager() {
  case "$OS_ID" in
    debian|ubuntu|linuxmint|pop|raspbian|kali|astra|devuan) printf 'apt'; return 0 ;;
    alpine) printf 'apk'; return 0 ;;
    arch|manjaro|endeavouros) printf 'pacman'; return 0 ;;
    fedora) printf 'dnf'; return 0 ;;
    rhel|centos|rocky|almalinux|ol)
      if command -v dnf >/dev/null 2>&1; then printf 'dnf'; else printf 'yum'; fi
      return 0
      ;;
  esac
  case " $OS_LIKE " in
    *" debian "*|*" ubuntu "*) printf 'apt'; return 0 ;;
    *" rhel "*|*" fedora "*|*" centos "*)
      if command -v dnf >/dev/null 2>&1; then printf 'dnf'; else printf 'yum'; fi
      return 0
      ;;
    *" arch "*) printf 'pacman'; return 0 ;;
    *" alpine "*) printf 'apk'; return 0 ;;
  esac
  if command -v apt-get >/dev/null 2>&1; then
    printf 'apt'
  elif command -v dnf >/dev/null 2>&1; then
    printf 'dnf'
  elif command -v yum >/dev/null 2>&1; then
    printf 'yum'
  elif command -v pacman >/dev/null 2>&1; then
    printf 'pacman'
  elif command -v apk >/dev/null 2>&1; then
    printf 'apk'
  else
    return 1
  fi
}

pkg_alts() {
  local cmd="$1" pm="$2"
  case "$pm:$cmd" in
    *:jq) printf '%s\n' jq ;;
    apt:dig|apt:nslookup) printf '%s\n' dnsutils bind9-dnsutils ;;
    dnf:dig|yum:dig|dnf:nslookup|yum:nslookup) printf '%s\n' bind-utils ;;
    pacman:dig|pacman:nslookup) printf '%s\n' bind ;;
    apk:dig|apk:nslookup) printf '%s\n' bind-tools ;;
    apt:column) printf '%s\n' bsdextrautils bsdmainutils ;;
    dnf:column|yum:column|pacman:column) printf '%s\n' util-linux ;;
    apk:column) printf '%s\n' util-linux-misc util-linux ;;
    *) return 1 ;;
  esac
}

root_prefix() {
  if [ "${EUID:-$(id -u)}" -eq 0 ]; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    printf 'sudo -n'
    return 0
  fi
  return 1
}

install_one_package() {
  local pm="$1" pkg="$2"
  local prefix=""
  prefix="$(root_prefix)" || die "Нужны права root, чтобы установить: ${pkg}"
  # shellcheck disable=SC2086
  case "$pm" in
    apt)
      $prefix env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y -qq "$pkg"
      ;;
    dnf) $prefix dnf install -y "$pkg" ;;
    yum) $prefix yum install -y "$pkg" ;;
    pacman) $prefix pacman -S --noconfirm --needed "$pkg" ;;
    apk) $prefix apk add --no-cache "$pkg" ;;
    *) return 1 ;;
  esac
}

install_cmd() {
  local pm="$1" cmd="$2" alt
  while IFS= read -r alt; do
    [ -n "$alt" ] || continue
    log "  пакет ${alt} → команда ${cmd}"
    if install_one_package "$pm" "$alt"; then
      command -v "$cmd" >/dev/null 2>&1 && return 0
    fi
  done < <(pkg_alts "$cmd" "$pm")
  return 1
}

ensure_cmds() {
  local missing=() cmd pm prefix=""
  detect_os
  pm="$(detect_pkg_manager)" || pm=""
  log "ОС: ${OS_NAME} (id=${OS_ID}${OS_LIKE:+ like=${OS_LIKE}}, pkg=${pm:-unknown})"

  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
  done
  [ "${#missing[@]}" -eq 0 ] && return 0
  [ -n "$pm" ] || die "Не удалось определить пакетный менеджер (${OS_NAME}). Установите вручную: ${missing[*]}"
  log "Отсутствуют команды: ${missing[*]}. Устанавливаю..."

  if [ "$pm" = apt ]; then
    prefix="$(root_prefix)" || die "Нужны права root, чтобы установить: ${missing[*]}"
    # shellcheck disable=SC2086
    $prefix env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update -qq
  fi

  for cmd in "${missing[@]}"; do
    install_cmd "$pm" "$cmd" || die "Не удалось установить зависимость для '$cmd' (${OS_NAME})"
    command -v "$cmd" >/dev/null 2>&1 || die "Команда '$cmd' так и не появилась после установки"
  done
}

require_cmd curl
require_cmd bash
ensure_cmds jq dig column nslookup

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

# Короткий таймаут: на обычном VPS link-local просто не ответит.
curl_meta() {
  curl -fsS --connect-timeout 1 --max-time 1 "$@" 2>/dev/null || true
}

detect_cloud_hoster() {
  local body=""
  body="$(curl_meta http://169.254.169.254/hetzner/v1/metadata)"
  if [ -n "$body" ]; then
    printf 'Hetzner'
    return 0
  fi
  body="$(curl_meta http://169.254.169.254/metadata/v1/id)"
  if [ -n "$body" ]; then
    printf 'DigitalOcean'
    return 0
  fi
  body="$(curl_meta http://169.254.169.254/v1/instanceid)"
  if [ -n "$body" ]; then
    printf 'Vultr'
    return 0
  fi
  body="$(curl_meta http://169.254.169.254/linode/v1/instance-id)"
  if [ -n "$body" ]; then
    printf 'Linode'
    return 0
  fi
  body="$(curl_meta -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/id)"
  if [ -n "$body" ]; then
    printf 'Google Cloud'
    return 0
  fi
  body="$(curl_meta -H 'Metadata: true' 'http://169.254.169.254/metadata/instance?api-version=2021-02-01')"
  if [ -n "$body" ]; then
    printf 'Azure'
    return 0
  fi
  body="$(curl_meta http://169.254.169.254/latest/meta-data/instance-id)"
  if [ -n "$body" ]; then
    printf 'AWS'
    return 0
  fi
  return 1
}

detect_asn_org() {
  local ip="$1" json="" org=""
  json="$(curl -fsS --connect-timeout 4 --max-time 8 "https://ipwho.is/${ip}" 2>/dev/null || true)"
  if [ -n "$json" ]; then
    org="$(printf '%s' "$json" | jq -r '.connection.org // .org // empty' 2>/dev/null || true)"
    if [ -n "$org" ] && [ "$org" != "null" ]; then
      printf '%s' "$org"
      return 0
    fi
  fi
  json="$(curl -fsS --connect-timeout 4 --max-time 8 "https://ipinfo.io/${ip}/json" 2>/dev/null || true)"
  if [ -n "$json" ]; then
    org="$(printf '%s' "$json" | jq -r '.org // empty' 2>/dev/null || true)"
    if [ -n "$org" ] && [ "$org" != "null" ]; then
      printf '%s' "$org"
      return 0
    fi
  fi
  return 1
}

detect_ptr_hint() {
  local ip="$1" ptr=""
  command -v dig >/dev/null 2>&1 || return 1
  ptr="$(dig +short -x "$ip" 2>/dev/null | awk 'NF{print; exit}' | tr -d '\r' | sed 's/\.$//')"
  [ -n "$ptr" ] || return 1
  printf '%s' "$ptr"
}

detect_hoster() {
  local ip="$1" value=""
  value="$(detect_cloud_hoster)" && { printf '%s' "$value"; return 0; }
  value="$(detect_asn_org "$ip")" && { printf '%s' "$value"; return 0; }
  value="$(detect_ptr_hint "$ip")" && { printf '%s' "$value"; return 0; }
  return 1
}

show_launcher_help() {
  cat <<EOF
Использование:
  curl -fsSL ${VT_API_URL}${DAILY_PATH} | bash
  curl -fsSL ${VT_API_URL}${DAILY_PATH} | bash -s -- --daily
  curl -fsSL ${VT_API_URL}${DAILY_PATH} | bash -s -- --remove-daily

  --daily            выполнить проверку и поставить cron раз в сутки
  --remove-daily     убрать ежедневный cron
EOF
}

daily_run_cmd() {
  local url="${VT_API_URL}${DAILY_PATH}"
  local curl_bin bash_bin flock_bin
  curl_bin="$(command -v curl)"
  bash_bin="$(command -v bash)"
  flock_bin="$(command -v flock || true)"
  if [ -n "$flock_bin" ]; then
    printf "%s -n /tmp/%s.lock -c '%s -fsSL --max-time 180 %s | %s'" \
      "$flock_bin" "$DAILY_SLUG" "$curl_bin" "$url" "$bash_bin"
  else
    printf '%s -fsSL --max-time 180 %s | %s' "$curl_bin" "$url" "$bash_bin"
  fi
}

daily_slot() {
  local seed n
  seed="$(hostname -f 2>/dev/null || hostname 2>/dev/null || cat /etc/hostname 2>/dev/null || echo vt)"
  n="$(printf '%s' "$seed" | cksum | awk '{print $1}')"
  DAILY_MINUTE=$((n % 60))
  DAILY_HOUR=$((3 + (n / 60) % 4))
}

remove_daily() {
  local prefix="" removed=0
  if [ -e "/etc/cron.d/${DAILY_SLUG}" ]; then
    if prefix="$(root_prefix)"; then
      # shellcheck disable=SC2086
      $prefix rm -f "/etc/cron.d/${DAILY_SLUG}"
      removed=1
    fi
  fi
  if command -v crontab >/dev/null 2>&1; then
    local current
    current="$(crontab -l 2>/dev/null || true)"
    if printf '%s\n' "$current" | grep -qF "vps-tracker:${DAILY_SLUG}"; then
      printf '%s\n' "$current" | grep -vF "vps-tracker:${DAILY_SLUG}" | crontab -
      removed=1
    fi
  fi
  if [ "$removed" -eq 1 ]; then
    log "Ежедневная проверка снята (${DAILY_SLUG})"
  else
    log "Ежедневная проверка не была установлена"
  fi
}

install_daily() {
  daily_slot
  local run line prefix=""
  local marker="# vps-tracker:${DAILY_SLUG}"
  run="$(daily_run_cmd)"

  if [ -d /etc/cron.d ] && prefix="$(root_prefix)"; then
    local tmp
    tmp="$(mktemp)"
    cat >"$tmp" <<EOF
# Managed by VPS Tracker launcher. ${marker}
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""
${DAILY_MINUTE} ${DAILY_HOUR} * * * root ${run} >>/var/log/${DAILY_SLUG}.log 2>&1
EOF
    # shellcheck disable=SC2086
    $prefix cp "$tmp" "/etc/cron.d/${DAILY_SLUG}"
    # shellcheck disable=SC2086
    $prefix chmod 644 "/etc/cron.d/${DAILY_SLUG}"
    rm -f "$tmp"
    log "Ежедневная проверка: каждый день в ${DAILY_HOUR}:$(printf '%02d' "$DAILY_MINUTE") (/etc/cron.d/${DAILY_SLUG})"
    log "Снять: curl -fsSL ${VT_API_URL}${DAILY_PATH} | bash -s -- --remove-daily"
    return 0
  fi

  if ! command -v crontab >/dev/null 2>&1; then
    die "Нет cron (ни /etc/cron.d, ни crontab). Установите пакет cron и повторите --daily"
  fi
  line="${DAILY_MINUTE} ${DAILY_HOUR} * * * ${run} >>/tmp/${DAILY_SLUG}.log 2>&1 ${marker}"
  {
    (crontab -l 2>/dev/null || true) | grep -vF "vps-tracker:${DAILY_SLUG}" || true
    printf '%s\n' "$line"
  } | crontab -
  log "Ежедневная проверка: каждый день в ${DAILY_HOUR}:$(printf '%02d' "$DAILY_MINUTE") (crontab)"
  log "Снять: curl -fsSL ${VT_API_URL}${DAILY_PATH} | bash -s -- --remove-daily"
}

write_vendor() {
  local dest="$1"
  if [ -n "${IPREGION_VENDOR_B64:-}" ]; then
    printf '%s' "$IPREGION_VENDOR_B64" | base64 -d >"$dest" 2>/dev/null \
      || printf '%s' "$IPREGION_VENDOR_B64" | base64 -D >"$dest"
    return 0
  fi
  curl -fsSL --max-time 30 "${VT_API_URL}/ic/vendor" -o "$dest"
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

DAILY_INSTALL=0
DAILY_REMOVE=0
for arg in "$@"; do
  case "$arg" in
    --daily|--install-daily) DAILY_INSTALL=1 ;;
    --remove-daily|--uninstall-daily) DAILY_REMOVE=1 ;;
    -h|--help) show_launcher_help; exit 0 ;;
    *) die "Неизвестный аргумент: $arg. См. --help" ;;
  esac
done

if [ "$DAILY_REMOVE" -eq 1 ]; then
  remove_daily
  exit 0
fi

TMPDIR="$(mktemp -d /tmp/vt-ipregion.XXXXXX)"
cleanup() { rm -rf "$TMPDIR"; }
trap 'cleanup; exit 130' INT
trap 'cleanup' EXIT

VENDOR="$TMPDIR/ipregion.sh"
write_vendor "$VENDOR"
chmod +x "$VENDOR"

PUBLIC_IP="$(detect_public_ip)"
[ -n "$PUBLIC_IP" ] || die "Не удалось определить публичный IP"

HOSTER="$(detect_hoster "$PUBLIC_IP" || true)"

RUN_ID="$(uuid4)"
[ -n "$RUN_ID" ] || die "Не удалось сгенерировать runId"

log "ipregion launcher ${LAUNCHER_VERSION} (vendor ${VENDOR_SHA})"
log "probe IP: ${PUBLIC_IP}"
log "хостер: ${HOSTER:-не определён}"
log "runId: ${RUN_ID}"
log "Определяю страны GeoIP (IPv4)..."

set +e
# stdout = JSON; stderr = прогресс (не перехватывать)
RAW_JSON="$(bash "$VENDOR" --json --ipv4)"
CC_EXIT=$?
set -e
if [ "$CC_EXIT" -ne 0 ]; then
  log "ipregion завершился с кодом ${CC_EXIT}" >&2
  exit 1
fi

PAYLOAD="$TMPDIR/payload.json"
printf '%s' "$RAW_JSON" | jq --arg runId "$RUN_ID" --arg ip "$PUBLIC_IP" --arg lv "$LAUNCHER_VERSION" --arg hoster "$HOSTER" '
  def items($group):
    ((.results[$group] // []) | map({
      service: .service,
      group: $group,
      ipv4: (.ipv4 // null),
      ipv6: (.ipv6 // null)
    }));
  {
    schemaVersion: 1,
    runId: $runId,
    probe: ({ publicIp: $ip } + if ($hoster | length) > 0 then { hoster: $hoster } else {} end),
    launcherVersion: $lv,
    ipregion: {
      version: ((.version | tostring) // "1")
    },
    results: (items("primary") + items("custom") + items("cdn"))
  }
' >"$PAYLOAD"

FALLBACK="/tmp/vt-ipregion-${RUN_ID}.json"
set +e
RESP="$(curl -fsS --max-time 60 -X POST "${VT_API_URL}/api/integrations/ipregion/runs" \
  -H "Authorization: Bearer ${VT_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @"$PAYLOAD")"
POST_EXIT=$?
set -e

if [ "$POST_EXIT" -ne 0 ]; then
  cp "$PAYLOAD" "$FALLBACK"
  log "API недоступен (curl exit ${POST_EXIT}). JSON сохранён: ${FALLBACK}" >&2
  if [ "$DAILY_INSTALL" -eq 1 ]; then
    install_daily
  fi
  exit 2
fi

CHECK_ID="$(printf '%s' "$RESP" | jq -r '.id // empty')"
MATCHED="$(printf '%s' "$RESP" | jq -r '.matchedVpsId // "unmatched"')"
if [ -z "$CHECK_ID" ]; then
  cp "$PAYLOAD" "$FALLBACK"
  log "Некорректный ответ API. JSON сохранён: ${FALLBACK}" >&2
  log "$RESP" >&2
  if [ "$DAILY_INSTALL" -eq 1 ]; then
    install_daily
  fi
  exit 2
fi

log "Check ID: ${CHECK_ID}"
log "VPS: ${MATCHED}"
if [ "$DAILY_INSTALL" -eq 1 ]; then
  install_daily
fi
exit 0
