# VPS Tracker — blocking launcher for RouterOS 7.22+
# First run: :global vtIface "ether1"; /tool fetch url="__VT_API_URL__/cc.rsc" dst-path=vt-cc.rsc; /import file-name=vt-cc.rsc
# Optional: :global vtGw "x.x.x.x" if the WAN gateway is not DHCP / not .1 of the subnet.
# HTTPS GET only (no DPI/SNI). Ingest: POST /api/integrations/censorcheck/runs

:local vtApi "__VT_API_URL__"
:local vtToken "__VT_INGEST_TOKEN__"
:local vtDaily "__VT_DAILY__"
:local vtRemove "__VT_REMOVE_DAILY__"
:local launcherVer "ros-3"
:local schedName "vt-cc"
:local dstFile "vt-cc.rsc"
:local rtName "vt-cc"
:local rtComment "vt-cc-probe"

:local ver [/system resource get version]
:local dot [:find $ver "."]
:if ([:typeof $dot] = "nil") do={
  :error ("Need RouterOS 7.22+ (got " . $ver . ")")
}
:local major [:tonum [:pick $ver 0 $dot]]
:local rest [:pick $ver ($dot + 1) [:len $ver]]
:local cut [:len $rest]
:local d2 [:find $rest "."]
:local sp [:find $rest " "]
:if ([:typeof $d2] != "nil") do={ :set cut $d2 }
:if (([:typeof $sp] != "nil") and (($cut = [:len $rest]) or ($sp < $cut))) do={ :set cut $sp }
:local minor [:tonum [:pick $rest 0 $cut]]
:if (($major < 7) or (($major = 7) and ($minor < 22))) do={
  :error ("Need RouterOS 7.22+ (got " . $ver . ")")
}

:if ($vtRemove = "yes") do={
  :do { /system scheduler remove [find name=$schedName] } on-error={}
  :do { /ip firewall mangle remove [find comment=$rtComment] } on-error={}
  :do { /ip firewall nat remove [find comment=$rtComment] } on-error={}
  :do { /routing rule remove [find comment=$rtComment] } on-error={}
  :do { /ip route remove [find comment=$rtComment] } on-error={}
  :put ("Ежедневная проверка снята (" . $schedName . ")")
} else={

:put ("censorcheck launcher " . $launcherVer . " (RouterOS)")

:global vtIface
:if (([:typeof $vtIface] != "str") or ([:len $vtIface] = 0)) do={
  :put "Задайте интерфейс и повторите импорт:"
  :put ":global vtIface \"ether1\""
  :put "Интерфейсы:"
  /interface print
  :error "vtIface не задан"
}
:if ([:len [/interface find where name=$vtIface]] = 0) do={
  :put "Интерфейсы:"
  /interface print
  :error ("Нет интерфейса " . $vtIface)
}

:local srcIp ""
:local addrRaw
:local slash
:local pfxLen 0
:local net
:foreach a in=[/ip address find where interface=$vtIface] do={
  :if ([:len $srcIp] = 0) do={
    :set addrRaw [/ip address get $a address]
    :set slash [:find $addrRaw "/"]
    :if ([:typeof $slash] != "nil") do={
      :set srcIp [:pick $addrRaw 0 $slash]
      :set pfxLen [:tonum [:pick $addrRaw ($slash + 1) [:len $addrRaw]]]
    } else={
      :set srcIp $addrRaw
    }
  }
}
:if ([:len $srcIp] = 0) do={
  :error ("Нет IPv4 на интерфейсе " . $vtIface)
}
:put ("интерфейс: " . $vtIface . " src=" . $srcIp)

:local gw ""
:local itype ""
:local igw
:local needle
:local fnd
:local gwy
:local failMsg ""
:local after
:do { /ip firewall mangle remove [find comment=$rtComment] } on-error={}
:do { /ip firewall nat remove [find comment=$rtComment] } on-error={}
:do { /routing rule remove [find comment=$rtComment] } on-error={}
:do { /ip route remove [find comment=$rtComment] } on-error={}
:do { /routing table add name=$rtName fib } on-error={}
:if ([:len [/ip dhcp-client find where interface=$vtIface]] > 0) do={
  :do { :set gw [/ip dhcp-client get [find interface=$vtIface] gateway] } on-error={}
}
:if ([:len $gw] = 0) do={
  :foreach rte in=[/ip route find where active] do={
    :if ([:len $gw] = 0) do={
      :set igw [/ip route get $rte immediate-gw]
      :if ([:typeof $igw] = "str") do={
        :set needle ("%" . $vtIface)
        :set fnd [:find $igw $needle]
        :if ([:typeof $fnd] != "nil") do={
          :set after ($fnd + [:len $needle])
          :if (($after = [:len $igw]) or ([:pick $igw $after ($after + 1)] = " ")) do={
            :set gw [:pick $igw 0 $fnd]
          }
        }
      }
      :if ([:len $gw] = 0) do={
        :set gwy [/ip route get $rte gateway]
        :if (([:typeof $gwy] = "str") and ($gwy = $vtIface)) do={
          :set gw $vtIface
        }
      }
    }
  }
}
:if ([:len $gw] = 0) do={
  :do { :set itype [/interface get [find name=$vtIface] type] } on-error={}
  :if (($itype = "pppoe-out") or ($itype = "pptp-out") or ($itype = "l2tp-out") or ($itype = "sstp-out") or ($itype = "ovpn-out") or ($itype = "wireguard")) do={
    :set gw $vtIface
  }
}
:if (([:len $gw] = 0) and ($pfxLen > 0) and ($pfxLen <= 30)) do={
  :foreach a in=[/ip address find where interface=$vtIface] do={
    :if ([:len $gw] = 0) do={
      :do {
        :set net [/ip address get $a network]
        :set gw [:tostr ([:toip $net] + 1)]
      } on-error={}
    }
  }
}
:global vtGw
:if (([:typeof $vtGw] = "str") and ([:len $vtGw] > 0)) do={
  :set gw $vtGw
}
:if ([:len $gw] = 0) do={
  :set gw $vtIface
}
:put ("шлюз: " . $gw)
:do {
  /ip route add dst-address=0.0.0.0/0 gateway=$gw routing-table=$rtName pref-src=$srcIp comment=$rtComment
} on-error={
  :do {
    /ip route add dst-address=0.0.0.0/0 gateway=($gw . "%" . $vtIface) routing-table=$rtName pref-src=$srcIp comment=$rtComment
  } on-error={
    :set failMsg ("Не удалось добавить маршрут через " . $gw)
  }
}
:if ([:len $failMsg] = 0) do={
  :do {
    /ip firewall mangle add chain=output action=mark-routing new-routing-mark=$rtName src-address=$srcIp passthrough=no comment=$rtComment place-before=0
  } on-error={
    /ip firewall mangle add chain=output action=mark-routing new-routing-mark=$rtName src-address=$srcIp passthrough=no comment=$rtComment
  }
  :do {
    /routing rule add src-address=($srcIp . "/32") action=lookup-only-in-table table=$rtName comment=$rtComment
  } on-error={}
  :do {
    /ip firewall nat add chain=srcnat action=accept src-address=$srcIp comment=$rtComment place-before=0
  } on-error={
    /ip firewall nat add chain=srcnat action=accept src-address=$srcIp comment=$rtComment
  }
}

:local r
:local publicIp ""
:if ([:len $failMsg] = 0) do={
:do {
  :set r [/tool fetch url="https://api.ipify.org" src-address=$srcIp output=user as-value]
  :if (($r->"status") = "finished") do={
    :set publicIp ($r->"data")
  }
} on-error={}
:local cr [:find $publicIp "\r"]
:if ([:typeof $cr] != "nil") do={ :set publicIp [:pick $publicIp 0 $cr] }
:local lf [:find $publicIp "\n"]
:if ([:typeof $lf] != "nil") do={ :set publicIp [:pick $publicIp 0 $lf] }
:if ([:len $publicIp] = 0) do={
  :do {
    :set r [/tool fetch url="https://ifconfig.me/ip" src-address=$srcIp output=user as-value]
    :if (($r->"status") = "finished") do={
      :set publicIp ($r->"data")
    }
  } on-error={}
  :set cr [:find $publicIp "\r"]
  :if ([:typeof $cr] != "nil") do={ :set publicIp [:pick $publicIp 0 $cr] }
  :set lf [:find $publicIp "\n"]
  :if ([:typeof $lf] != "nil") do={ :set publicIp [:pick $publicIp 0 $lf] }
}
:if ([:len $publicIp] = 0) do={
  :set failMsg "Не удалось определить публичный IP"
} else={

:local hoster ""
:do {
  :set r [/tool fetch url=("https://ipwho.is/" . $publicIp) src-address=$srcIp output=user as-value]
  :if (($r->"status") = "finished") do={
    :local j [:deserialize from=json value=($r->"data")]
    :local isp ($j->"connection"->"isp")
    :if ([:typeof $isp] = "str") do={ :set hoster $isp }
    :if ([:len $hoster] = 0) do={
      :local org ($j->"org")
      :if ([:typeof $org] = "str") do={ :set hoster $org }
    }
  }
} on-error={}

:local runId ("mt-" . [:rndstr length=16])
:put ("probe IP: " . $publicIp)
:if ($publicIp != $srcIp) do={
  :put ("внимание: probe IP " . $publicIp . " != src " . $srcIp)
}
:if ([:len $hoster] > 0) do={ :put ("хостер: " . $hoster) }
:put ("runId: " . $runId)
:put "Проверяю сайты (HTTPS GET, без DPI)..."

:local hosts {\
  "youtube.com";"redirector.googlevideo.com";"discord.com";"instagram.com";"facebook.com";\
  "x.com";"linkedin.com";"rutracker.org";"digitalocean.com";"amnezia.org";"getoutline.org";\
  "mailfence.com";"flibusta.is";"rezka.ag";"api.telegram.org";"play.google.com";\
  "spotify.com";"netflix.com";"patreon.com";"swagger.io";"snyk.io";"mongodb.com";\
  "autodesk.com";"graylog.org";"redis.io";"copilot.microsoft.com"\
}

:local results ({})
:local code 0
:local data
:local line
:local nl
:local cr2
:local sp1
:local rest2
:local sp2
:local codeStr
:local n
:local item
:foreach host in=$hosts do={
  :set code 0
  :do {
    :set r [/tool fetch url=("https://" . $host . "/") src-address=$srcIp output=user-with-headers as-value]
    :if (($r->"status") != "finished") do={
      :set code -1
    } else={
      :set data ($r->"data")
      :set line $data
      :set nl [:find $data "\n"]
      :if ([:typeof $nl] != "nil") do={ :set line [:pick $data 0 $nl] }
      :set cr2 [:find $line "\r"]
      :if ([:typeof $cr2] != "nil") do={ :set line [:pick $line 0 $cr2] }
      :if ([:pick $line 0 4] = "HTTP") do={
        :set sp1 [:find $line " "]
        :if ([:typeof $sp1] != "nil") do={
          :set rest2 [:pick $line ($sp1 + 1) [:len $line]]
          :set sp2 [:find $rest2 " "]
          :set codeStr $rest2
          :if ([:typeof $sp2] != "nil") do={ :set codeStr [:pick $rest2 0 $sp2] }
          :set n [:tonum $codeStr]
          :if ([:typeof $n] = "num") do={ :set code $n } else={ :set code 200 }
        } else={ :set code 200 }
      } else={ :set code 200 }
    }
  } on-error={
    :set code 0
  }
  :put ($host . " " . $code)
  :set item { service=$host; raw={ https={ ipv4={ status=$code } } } }
  :set ($results->[:len $results]) $item
}

:local probe { publicIp=$publicIp }
:if ([:len $hoster] > 0) do={ :set ($probe->"hoster") $hoster }

:local payload {\
  schemaVersion=1;\
  runId=$runId;\
  probe=$probe;\
  launcherVersion=$launcherVer;\
  censorcheck={ version="ros"; mode="https" };\
  results=$results\
}
:local json [:serialize to=json value=$payload]
:local hdrs ("Content-Type: application/json,Authorization: Bearer " . $vtToken)
:put "Отправляю ingest..."
:do {
  :set r [/tool fetch url=($vtApi . "/api/integrations/censorcheck/runs") src-address=$srcIp http-method=post http-header-field=$hdrs http-data=$json output=user as-value]
  :put ($r->"data")
} on-error={
  :put "API недоступен (fetch error)"
}

:if ($vtDaily = "yes") do={
  :local ident [/system identity get name]
  :local h ([:len $ident] + [:len [/system resource get architecture-name]])
  :local hour (3 + ($h % 4))
  :local minute (($h * 17) % 60)
  :local hh $hour
  :local mm $minute
  :if ($hour < 10) do={ :set hh ("0" . $hour) }
  :if ($minute < 10) do={ :set mm ("0" . $minute) }
  :local startTime ($hh . ":" . $mm . ":00")
  :local ev (":global vtIface \"" . $vtIface . "\"; /tool fetch url=" . $vtApi . "/cc.rsc dst-path=" . $dstFile . "; /import file-name=" . $dstFile)
  :do { /system scheduler remove [find name=$schedName] } on-error={}
  /system scheduler add name=$schedName interval=1d start-time=$startTime on-event=$ev policy=read,write,test,policy comment="vps-tracker vt-cc"
  :put ("Ежедневная проверка: каждый день в " . $startTime . " (" . $schedName . ")")
  :put ("Снять: /tool fetch url=" . $vtApi . "/cc.rsc?remove=daily dst-path=" . $dstFile . "; /import file-name=" . $dstFile)
}

}

}

:do { /ip firewall mangle remove [find comment=$rtComment] } on-error={}
:do { /ip firewall nat remove [find comment=$rtComment] } on-error={}
:do { /routing rule remove [find comment=$rtComment] } on-error={}
:do { /ip route remove [find comment=$rtComment] } on-error={}
:if ([:len $failMsg] > 0) do={ :error $failMsg }

}
