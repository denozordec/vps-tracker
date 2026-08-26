# VPS Tracker — GeoIP launcher for RouterOS 7.22+
# First run: :global "vt-srcIp" "1.2.3.4"; /tool fetch url="__VT_API_URL__/ic.rsc" dst-path=vt-ic.rsc; /import file-name=vt-ic.rsc
# Полный список vernette/ipregion (primary + custom + cdn, без Google Search Captcha). Ingest: POST /api/integrations/ipregion/runs

:local vtApi "__VT_API_URL__"
:local vtToken "__VT_INGEST_TOKEN__"
:local vtDaily "__VT_DAILY__"
:local vtRemove "__VT_REMOVE_DAILY__"
:local launcherVer "ros-8"
:local schedName "vt-ic"
:local dstFile "vt-ic.rsc"

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
  :put ("Ежедневная проверка снята (" . $schedName . ")")
} else={

:put ("ipregion launcher " . $launcherVer . " (RouterOS)")

:global "vt-srcIp"
:if (([:typeof $"vt-srcIp"] != "str") or ([:len $"vt-srcIp"] = 0)) do={
  :put "Задайте исходный IP и повторите импорт:"
  :put ":global \"vt-srcIp\" \"1.2.3.4\""
  :error "vt-srcIp не задан"
}
:local srcIp $"vt-srcIp"
:put ("vt-srcIp: " . $srcIp)
:local ingestOk false

:local ua "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
:local twitchClientId "kimne78kx3ncx6brgo4mv6wki5h1ko"
:local chatgptKey "client-zUdXdSTygXJdzoE0sWTkP8GKTVsUMF2IRM7ShVO2JAG"
:local spotifyKey "142b583129b2df829de3656f9eb484e6"
:local spotifyClientId "9a8d2f0ce77a4e248bb71fefcb557637"
:local netflixKey "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm"
:local redditBasic "b2hYcG9xclpZdWIxa2c6"
:local disneyKey "ZGlzbmV5JmFuZHJvaWQmMS4wLjA.bkeb0m230uUhv8qrAXuNu39tbE_mD5EEhM_NAcohjyA"
:local youtubeSocs "CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjUwNzMwLjA1X3AwGgJlbiACGgYIgPC_xAY"
:local disneyBody "{\"query\":\" mutation registerDevice($registerDevice: RegisterDeviceInput!) { registerDevice(registerDevice: $registerDevice) { __typename } } \",\"variables\":{\"registerDevice\":{\"applicationRuntime\":\"android\",\"attributes\":{\"operatingSystem\":\"Android\",\"operatingSystemVersion\":\"13\"},\"deviceFamily\":\"android\",\"deviceLanguage\":\"en\",\"deviceProfile\":\"phone\",\"devicePlatformId\":\"android\"}},\"operationName\":\"registerDevice\"}"
:local twitchBody "[{\"operationName\":\"VerifyEmail_CurrentUser\",\"variables\":{},\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"f9e7dcdf7e99c314c82d8f7f725fab5f99d1df3d7359b53c9ae122deec590198\"}}}]"
:local redditGqlBody "{\"operationName\":\"UserLocation\",\"variables\":{},\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"f07de258c54537e24d7856080f662c1b1268210251e5789c8c08f20d76cc8ab2\"}}}"
:local redditUa "Reddit/Version 2025.29.0/Build 2529021/Android 13"

:local r
:local j
:local isp
:local org
:local publicIp ""
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
  :error "Не удалось определить публичный IP"
}

:local hoster ""
:do {
  :set r [/tool fetch url=("https://ipwho.is/" . $publicIp) src-address=$srcIp output=user as-value]
  :if (($r->"status") = "finished") do={
    :set j [:deserialize from=json value=($r->"data")]
    :set isp ($j->"connection"->"isp")
    :if ([:typeof $isp] = "str") do={ :set hoster $isp }
    :if ([:len $hoster] = 0) do={
      :set org ($j->"org")
      :if ([:typeof $org] = "str") do={ :set hoster $org }
    }
  }
} on-error={}

:local runId ("mt-" . [:rndstr length=16])
:put ("probe IP: " . $publicIp)
:if ([:len $hoster] > 0) do={ :put ("хостер: " . $hoster) }
:put ("runId: " . $runId)
:put "Проверяю GeoIP (JSON, IPv4)..."

:local names {\
  "maxmind.com";"rdap.db.ripe.net";"ipinfo.io";"cloudflare.com";"ipregistry.co";\
  "ipapi.co";"ifconfig.co";"ip2location.io";"iplocation.com";"country.is";\
  "geoapify.com";"geojs.io";"ipapi.is";"ipbase.com";"ipquery.io";"ipwho.is";\
  "ip-api.com";\
  "Google";"YouTube";"Twitch";"ChatGPT";"Netflix";"Spotify";"Reddit";"Disney+";\
  "Gemini Supported";"Reddit (Guest Access)";"YouTube Premium";"Spotify Signup";\
  "Disney+ Access";"Apple";"Steam";"Tiktok";"Ookla Speedtest";"JetBrains";\
  "PlayStation";"Microsoft";\
  "Cloudflare CDN";"YouTube CDN";"Netflix CDN"\
}

:local resultJson ""
:local itemJson ""
:local url ""
:local method "get"
:local postData ""
:local fetchHdrs ""
:local iso "N/A"
:local httpCode 0
:local body ""
:local data
:local line
:local nl
:local cr2
:local sp1
:local rest2
:local sp2
:local codeStr
:local n
:local sep
:local p
:local plain
:local pcr
:local plf
:local ctry
:local colo
:local iata
:local ci
:local marker
:local tmp
:local tmp2
:local tmp3
:local googleCode ""
:local token ""
:local statusStr ""
:local launched ""
:local errCnt ""
:local inLoc ""
:local countryName ""
:local regionsMd ""
:local lineStart ""
:local iataLoc ""
:local word3 ""
:local dashPos ""
:local hdrData ""
:local wi 0
:local wc 0

:foreach name in=$names do={
  :set url ""
  :set method "get"
  :set postData ""
  :set fetchHdrs ""
  :if ($name = "maxmind.com") do={
    :set url "https://geoip.maxmind.com/geoip/v2.1/city/me"
    :set fetchHdrs "Referer: https://www.maxmind.com"
  }
  :if ($name = "rdap.db.ripe.net") do={ :set url ("https://rdap.db.ripe.net/ip/" . $publicIp) }
  :if ($name = "ipinfo.io") do={ :set url ("https://ipinfo.io/widget/demo/" . $publicIp) }
  :if ($name = "cloudflare.com") do={ :set url "https://speed.cloudflare.com/meta" }
  :if ($name = "ipregistry.co") do={
    :set url ("https://api.ipregistry.co/" . $publicIp . "?hostname=true&key=sb69ksjcajfs4c")
    :set fetchHdrs "Origin: https://ipregistry.co"
  }
  :if ($name = "ipapi.co") do={ :set url ("https://ipapi.co/" . $publicIp . "/json") }
  :if ($name = "ifconfig.co") do={ :set url ("https://ifconfig.co/country-iso?ip=" . $publicIp) }
  :if ($name = "ip2location.io") do={ :set url ("https://api.ip2location.io/?ip=" . $publicIp) }
  :if ($name = "iplocation.com") do={
    :set url "https://iplocation.com"
    :set method "post"
    :set postData ("ip=" . $publicIp)
    :set fetchHdrs ("User-Agent: " . $ua)
  }
  :if ($name = "country.is") do={ :set url ("https://api.country.is/" . $publicIp) }
  :if ($name = "geoapify.com") do={ :set url ("https://api.geoapify.com/v1/ipinfo?&ip=" . $publicIp . "&apiKey=b8568cb9afc64fad861a69edbddb2658") }
  :if ($name = "geojs.io") do={ :set url ("https://get.geojs.io/v1/ip/country.json?ip=" . $publicIp) }
  :if ($name = "ipapi.is") do={ :set url ("https://api.ipapi.is/?q=" . $publicIp) }
  :if ($name = "ipbase.com") do={ :set url ("https://api.ipbase.com/v2/info?ip=" . $publicIp) }
  :if ($name = "ipquery.io") do={ :set url ("https://api.ipquery.io/" . $publicIp) }
  :if ($name = "ipwho.is") do={ :set url ("https://ipwho.is/" . $publicIp) }
  :if ($name = "ip-api.com") do={
    :set url ("https://demo.ip-api.com/json/" . $publicIp . "?fields=countryCode")
    :set fetchHdrs "Origin: https://ip-api.com"
  }
  :if ($name = "Google") do={
    :set url "https://accounts.google.com/v3/signin/identifier?flowName=GlifSetupAndroid"
    :set fetchHdrs ("User-Agent: " . $ua)
  }
  :if ($name = "YouTube") do={ :set url "https://www.youtube.com/sw.js_data" }
  :if ($name = "Twitch") do={
    :set url "https://gql.twitch.tv/gql"
    :set method "post"
    :set postData $twitchBody
    :set fetchHdrs ("Client-Id: " . $twitchClientId . ",Content-Type: application/json")
  }
  :if ($name = "ChatGPT") do={
    :set url "https://ab.chatgpt.com/v1/initialize"
    :set method "post"
    :set postData "{}"
    :set fetchHdrs ("Statsig-Api-Key: " . $chatgptKey . ",Content-Type: application/json")
  }
  :if ($name = "Netflix") do={ :set url ("https://api.fast.com/netflix/speedtest/v2?https=true&token=" . $netflixKey . "&urlCount=1") }
  :if ($name = "Spotify") do={
    :set url ("https://spclient.wg.spotify.com/signup/public/v1/account/?validate=1&key=" . $spotifyKey)
    :set fetchHdrs ("X-Client-Id: " . $spotifyClientId)
  }
  :if ($name = "Reddit") do={ :set url "reddit-oauth" }
  :if ($name = "Disney+") do={
    :set url "https://disney.api.edge.bamgrid.com/graph/v1/device/graphql"
    :set method "post"
    :set postData $disneyBody
    :set fetchHdrs ("Authorization: Bearer " . $disneyKey . ",Content-Type: application/json")
  }
  :if ($name = "Gemini Supported") do={ :set url "gemini-check" }
  :if ($name = "Reddit (Guest Access)") do={
    :set url "https://www.reddit.com"
    :set fetchHdrs ("User-Agent: " . $ua)
  }
  :if ($name = "YouTube Premium") do={
    :set url "https://www.youtube.com/premium"
    :set fetchHdrs ("User-Agent: " . $ua . ",Cookie: SOCS=" . $youtubeSocs . ",Accept-Language: en-US,en;q=0.9")
  }
  :if ($name = "Spotify Signup") do={
    :set url ("https://spclient.wg.spotify.com/signup/public/v1/account/?validate=1&key=" . $spotifyKey)
    :set fetchHdrs ("X-Client-Id: " . $spotifyClientId)
  }
  :if ($name = "Disney+ Access") do={
    :set url "https://disney.api.edge.bamgrid.com/graph/v1/device/graphql"
    :set method "post"
    :set postData $disneyBody
    :set fetchHdrs ("Authorization: Bearer " . $disneyKey . ",Content-Type: application/json")
  }
  :if ($name = "Apple") do={ :set url "https://gspe1-ssl.ls.apple.com/pep/gcc" }
  :if ($name = "Steam") do={
    :set url "https://store.steampowered.com"
    :set method "head"
  }
  :if ($name = "Tiktok") do={ :set url "https://www.tiktok.com/api/v1/web-cookie-privacy/config?appId=1988" }
  :if ($name = "Ookla Speedtest") do={ :set url "https://www.speedtest.net/api/js/config-sdk" }
  :if ($name = "JetBrains") do={ :set url "https://data.services.jetbrains.com/geo" }
  :if ($name = "PlayStation") do={
    :set url "https://www.playstation.com"
    :set method "head"
  }
  :if ($name = "Microsoft") do={ :set url "https://login.live.com" }
  :if ($name = "Cloudflare CDN") do={
    :set url "https://speed.cloudflare.com/meta"
    :set fetchHdrs "Referer: https://speed.cloudflare.com"
  }
  :if ($name = "YouTube CDN") do={ :set url "https://redirector.googlevideo.com/report_mapping?di=no" }
  :if ($name = "Netflix CDN") do={ :set url ("https://api.fast.com/netflix/speedtest/v2?https=true&token=" . $netflixKey . "&urlCount=1") }

  :set iso "N/A"
  :set httpCode 0
  :set body ""
  :set hdrData ""

  :if ($url = "reddit-oauth") do={
    :set token ""
    :do {
      :set r [/tool fetch url="https://www.reddit.com/auth/v2/oauth/access-token/loid" src-address=$srcIp http-method=post http-header-field=("Authorization: Basic " . $redditBasic . ",Content-Type: application/json,User-Agent: " . $redditUa) http-data="{\"scopes\":[\"email\"]}" output=user as-value]
      :if (($r->"status") = "finished") do={
        :set j [:deserialize from=json value=($r->"data")]
        :set token [:tostr ($j->"access_token")]
      }
    } on-error={}
    :if ([:len $token] > 0) do={
      :do {
        :set r [/tool fetch url="https://gql-fed.reddit.com" src-address=$srcIp http-method=post http-header-field=("Authorization: Bearer " . $token . ",Content-Type: application/json,User-Agent: " . $redditUa) http-data=$redditGqlBody output=user as-value]
        :if (($r->"status") = "finished") do={
          :set body ($r->"data")
          :set httpCode 200
        }
      } on-error={}
    }
  } else={
    :if ($url = "gemini-check") do={
      :set googleCode ""
      :do {
        :set r [/tool fetch url="https://accounts.google.com/v3/signin/identifier?flowName=GlifSetupAndroid" src-address=$srcIp http-header-field=("User-Agent: " . $ua) output=user-with-headers as-value]
        :if (($r->"status") = "finished") do={
          :set data ($r->"data")
          :set sep "\r\n\r\n"
          :set p [:find $data $sep]
          :if ([:typeof $p] = "nil") do={ :set sep "\n\n"; :set p [:find $data $sep] }
          :if ([:typeof $p] != "nil") do={ :set plain [:pick $data ($p + [:len $sep]) [:len $data]] } else={ :set plain $data }
          :set marker [:find $plain "name=\"region\" value=\""]
          :if ([:typeof $marker] != "nil") do={ :set googleCode [:pick $plain ($marker + 21) ($marker + 23)] }
        }
      } on-error={}
      :if ([:len $googleCode] = 2) do={
        :set countryName ""
        :do {
          :set r [/tool fetch url=("https://www.apicountries.com/alpha/" . $googleCode) src-address=$srcIp output=user as-value]
          :if (($r->"status") = "finished") do={
            :set j [:deserialize from=json value=($r->"data")]
            :set countryName [:tostr ($j->"name")]
          }
        } on-error={}
        :if (([:len $countryName] > 0) and ($countryName != "nil")) do={
          :set regionsMd ""
          :do {
            :set r [/tool fetch url="https://ai.google.dev/gemini-api/docs/available-regions.md.txt" src-address=$srcIp output=user as-value]
            :if (($r->"status") = "finished") do={ :set regionsMd ($r->"data") }
          } on-error={}
          :set lineStart ("- " . $countryName)
          :if ([:find $regionsMd $lineStart] != nil) do={ :set iso "Yes" } else={ :set iso "No" }
        }
      }
      :set httpCode 200
    } else={
      :do {
        :if ($method = "head") do={
          :if ([:len $fetchHdrs] > 0) do={
            :set r [/tool fetch url=$url src-address=$srcIp http-method=head http-header-field=$fetchHdrs output=user-with-headers as-value]
          } else={
            :set r [/tool fetch url=$url src-address=$srcIp http-method=head output=user-with-headers as-value]
          }
        } else={
          :if ($method = "post") do={
            :if ([:len $fetchHdrs] = 0) do={ :set fetchHdrs "Content-Type: application/x-www-form-urlencoded" }
            :if ([:find $fetchHdrs "Content-Type:"] = nil) do={
              :if ([:find $postData "{"] = 0) do={
                :set fetchHdrs ($fetchHdrs . ",Content-Type: application/json")
              } else={
                :set fetchHdrs ($fetchHdrs . ",Content-Type: application/x-www-form-urlencoded")
              }
            }
            :set r [/tool fetch url=$url http-method=post http-data=$postData http-header-field=$fetchHdrs src-address=$srcIp output=user-with-headers as-value]
          } else={
            :if ([:len $fetchHdrs] > 0) do={
              :set r [/tool fetch url=$url src-address=$srcIp http-header-field=$fetchHdrs output=user-with-headers as-value]
            } else={
              :set r [/tool fetch url=$url src-address=$srcIp output=user-with-headers as-value]
            }
          }
        }
        :if (($r->"status") != "finished") do={
          :set httpCode -1
        } else={
          :set data ($r->"data")
          :set hdrData $data
          :set line $data
          :set nl [:find $data "\n"]
          :if ([:typeof $nl] != "nil") do={ :set line [:pick $data 0 $nl] }
          :set cr2 [:find $line "\r"]
          :if ([:typeof $cr2] != "nil") do={ :set line [:pick $line 0 $cr2] }
          :set httpCode 200
          :if ([:pick $line 0 4] = "HTTP") do={
            :set sp1 [:find $line " "]
            :if ([:typeof $sp1] != "nil") do={
              :set rest2 [:pick $line ($sp1 + 1) [:len $line]]
              :set sp2 [:find $rest2 " "]
              :set codeStr $rest2
              :if ([:typeof $sp2] != "nil") do={ :set codeStr [:pick $rest2 0 $sp2] }
              :set n [:tonum $codeStr]
              :if ([:typeof $n] = "num") do={ :set httpCode $n }
            }
          }
          :set sep "\r\n\r\n"
          :set p [:find $data $sep]
          :if ([:typeof $p] = "nil") do={
            :set sep "\n\n"
            :set p [:find $data $sep]
          }
          :if ([:typeof $p] != "nil") do={
            :set body [:pick $data ($p + [:len $sep]) [:len $data]]
          } else={
            :set body $data
          }
        }
      } on-error={
        :set httpCode 0
      }
    }
  }

  :if (($httpCode = 0) or ($httpCode = -1)) do={ :set iso "N/A" }
  :if (($httpCode = 401) or ($httpCode = 403)) do={ :set iso "Denied" }
  :if ($httpCode = 429) do={ :set iso "Rate-limit" }
  :if ($httpCode >= 500) do={ :set iso "Server error" }
  :if (($httpCode >= 200) and ($httpCode < 400)) do={
    :if ($name = "ifconfig.co") do={
      :set plain $body
      :set pcr [:find $plain "\r"]
      :if ([:typeof $pcr] != "nil") do={ :set plain [:pick $plain 0 $pcr] }
      :set plf [:find $plain "\n"]
      :if ([:typeof $plf] != "nil") do={ :set plain [:pick $plain 0 $plf] }
      :if ([:len $plain] > 0) do={ :set iso $plain } else={ :set iso "N/A" }
    } else={
      :if ($name = "Google") do={
        :set marker [:find $body "name=\"region\" value=\""]
        :if ([:typeof $marker] != "nil") do={ :set iso [:pick $body ($marker + 21) ($marker + 23)] } else={ :set iso "N/A" }
      } else={
        :if ($name = "YouTube") do={
          :set plain $body
          :set nl [:find $plain "\n"]
          :if ([:typeof $nl] != "nil") do={ :set plain [:pick $plain ($nl + 1) [:len $plain]] }
          :set nl [:find $plain "\n"]
          :if ([:typeof $nl] != "nil") do={ :set plain [:pick $plain ($nl + 1) [:len $plain]] }
          :do {
            :set j [:deserialize from=json value=$plain]
            :set iso [:tostr (($j->0)->2->0->0->1)]
            :if (([:len $iso] = 0) or ($iso = "nil")) do={ :set iso "N/A" }
          } on-error={ :set iso "N/A" }
        } else={
          :if ($name = "Reddit (Guest Access)") do={
            :if ([:find $body "Denied"] != nil) do={ :set iso "No" } else={ :set iso "Yes" }
          } else={
            :if ($name = "YouTube Premium") do={
              :if ([:find $body "youtube premium is not available in your country"] != nil) do={ :set iso "No" } else={ :set iso "Yes" }
            } else={
              :if ($name = "Apple") do={
                :set plain $body
                :set pcr [:find $plain "\r"]
                :if ([:typeof $pcr] != "nil") do={ :set plain [:pick $plain 0 $pcr] }
                :set plf [:find $plain "\n"]
                :if ([:typeof $plf] != "nil") do={ :set plain [:pick $plain 0 $plf] }
                :if ([:len $plain] > 0) do={ :set iso $plain } else={ :set iso "N/A" }
              } else={
                :if ($name = "Steam") do={
                  :set marker [:find $hdrData "steamCountry="]
                  :if ([:typeof $marker] != "nil") do={
                    :set tmp [:pick $hdrData ($marker + 13) [:len $hdrData]]
                    :set tmp2 [:find $tmp ";"]
                    :if ([:typeof $tmp2] != "nil") do={ :set iso [:pick $tmp 0 $tmp2] } else={ :set iso $tmp }
                  } else={ :set iso "N/A" }
                } else={
                  :if ($name = "PlayStation") do={
                    :set marker [:find $hdrData "country="]
                    :if ([:typeof $marker] != "nil") do={
                      :set tmp [:pick $hdrData ($marker + 8) [:len $hdrData]]
                      :set tmp2 [:find $tmp ";"]
                      :if ([:typeof $tmp2] != "nil") do={ :set iso [:pick $tmp 0 $tmp2] } else={ :set iso $tmp }
                    } else={ :set iso "N/A" }
                  } else={
                    :if ($name = "Microsoft") do={
                      :set marker [:find $body "\"sRequestCountry\":\""]
                      :if ([:typeof $marker] != "nil") do={ :set iso [:pick $body ($marker + 19) ($marker + 21)] } else={ :set iso "N/A" }
                    } else={
                      :if ($name = "YouTube CDN") do={
                        :set iata ""
                        :set word3 ""
                        :set tmp $body
                        :set wi 0
                        :set wc 0
                        :while ($wi < [:len $tmp]) do={
                          :if ([:pick $tmp $wi ($wi + 1)] = " ") do={ :set wc ($wc + 1) }
                          :if ($wc = 3) do={
                            :set word3 [:pick $tmp $wi [:len $tmp]]
                            :set wi [:len $tmp]
                          }
                          :set wi ($wi + 1)
                        }
                        :if ([:len $word3] > 0) do={
                          :set dashPos [:find $word3 "-"]
                          :if ([:typeof $dashPos] != "nil") do={
                            :set tmp2 [:pick $word3 ($dashPos + 1) [:len $word3]]
                            :if ([:len $tmp2] >= 3) do={ :set iata [:pick $tmp2 0 3] }
                          }
                        }
                        :if ([:len $iata] = 3) do={
                          :set iataLoc ""
                          :do {
                            :set r [/tool fetch url="https://www.air-port-codes.com/api/v1/single" src-address=$srcIp http-method=post http-header-field="APC-Auth: 96dc04b3fb,Referer: https://www.air-port-codes.com/,Content-Type: application/x-www-form-urlencoded" http-data=("iata=" . $iata) output=user as-value]
                            :if (($r->"status") = "finished") do={
                              :set j [:deserialize from=json value=($r->"data")]
                              :set iataLoc [:tostr ($j->"airport"->"country"->"iso")]
                            }
                          } on-error={}
                          :if (([:len $iataLoc] > 0) and ($iataLoc != "nil")) do={ :set iso ($iataLoc . " (" . $iata . ")") } else={ :set iso ("N/A (" . $iata . ")") }
                        } else={ :set iso "N/A" }
                      } else={
                        :do {
                          :set j [:deserialize from=json value=$body]
                          :if ($name = "maxmind.com") do={ :set iso [:tostr ($j->"country"->"iso_code")] }
                          :if ($name = "rdap.db.ripe.net") do={ :set iso [:tostr ($j->"country")] }
                          :if ($name = "ipinfo.io") do={
                            :set iso [:tostr ($j->"data"->"country")]
                            :if (([:len $iso] = 0) or ($iso = "nil")) do={ :set iso [:tostr ($j->"country")] }
                          }
                          :if ($name = "cloudflare.com") do={ :set iso [:tostr ($j->"country")] }
                          :if ($name = "ipregistry.co") do={ :set iso [:tostr ($j->"location"->"country"->"code")] }
                          :if ($name = "ipapi.co") do={ :set iso [:tostr ($j->"country")] }
                          :if ($name = "ip2location.io") do={ :set iso [:tostr ($j->"country_code")] }
                          :if ($name = "iplocation.com") do={ :set iso [:tostr ($j->"country_code")] }
                          :if ($name = "country.is") do={ :set iso [:tostr ($j->"country")] }
                          :if ($name = "geoapify.com") do={ :set iso [:tostr ($j->"country"->"iso_code")] }
                          :if ($name = "geojs.io") do={ :set iso [:tostr ($j->0->"country")] }
                          :if ($name = "ipapi.is") do={ :set iso [:tostr ($j->"location"->"country_code")] }
                          :if ($name = "ipbase.com") do={ :set iso [:tostr ($j->"data"->"location"->"country"->"alpha2")] }
                          :if ($name = "ipquery.io") do={ :set iso [:tostr ($j->"location"->"country_code")] }
                          :if ($name = "ipwho.is") do={ :set iso [:tostr ($j->"country_code")] }
                          :if ($name = "ip-api.com") do={ :set iso [:tostr ($j->"countryCode")] }
                          :if ($name = "Twitch") do={ :set iso [:tostr ($j->0->"data"->"requestInfo"->"countryCode")] }
                          :if ($name = "ChatGPT") do={ :set iso [:tostr ($j->"derived_fields"->"country")] }
                          :if ($name = "Netflix") do={ :set iso [:tostr ($j->"client"->"location"->"country")] }
                          :if ($name = "Spotify") do={ :set iso [:tostr ($j->"country")] }
                          :if ($name = "Reddit") do={ :set iso [:tostr ($j->"data"->"userLocation"->"countryCode")] }
                          :if ($name = "Disney+") do={ :set iso [:tostr ($j->"extensions"->"sdk"->"session"->"location"->"countryCode")] }
                          :if ($name = "Spotify Signup") do={
                            :set statusStr [:tostr ($j->"status")]
                            :set launched [:tostr ($j->"is_country_launched")]
                            :if (($statusStr = "120") or ($statusStr = "320") or ($launched = "false")) do={ :set iso "No" } else={ :set iso "Yes" }
                          }
                          :if ($name = "Disney+ Access") do={
                            :set inLoc [:tostr ($j->"extensions"->"sdk"->"session"->"inSupportedLocation")]
                            :if ($inLoc = "true") do={ :set iso "Yes" } else={ :set iso "No" }
                          }
                          :if ($name = "Tiktok") do={ :set iso [:tostr ($j->"body"->"appProps"->"region")] }
                          :if ($name = "Ookla Speedtest") do={ :set iso [:tostr ($j->"location"->"countryCode")] }
                          :if ($name = "JetBrains") do={ :set iso [:tostr ($j->"code")] }
                          :if ($name = "Netflix CDN") do={ :set iso [:tostr ($j->"targets"->0->"location"->"country")] }
                          :if ($name = "Cloudflare CDN") do={
                            :set ctry [:tostr ($j->"country")]
                            :set colo ($j->"colo")
                            :set iata ""
                            :if ([:typeof $colo] = "str") do={ :set iata $colo }
                            :if ([:typeof $colo] = "array") do={
                              :set ci ($colo->"iata")
                              :if ([:typeof $ci] = "str") do={ :set iata $ci }
                            }
                            :if (([:len $iata] = 3)) do={
                              :set iataLoc ""
                              :do {
                                :set r [/tool fetch url="https://www.air-port-codes.com/api/v1/single" src-address=$srcIp http-method=post http-header-field="APC-Auth: 96dc04b3fb,Referer: https://www.air-port-codes.com/,Content-Type: application/x-www-form-urlencoded" http-data=("iata=" . $iata) output=user as-value]
                                :if (($r->"status") = "finished") do={
                                  :set j [:deserialize from=json value=($r->"data")]
                                  :set iataLoc [:tostr ($j->"airport"->"country"->"iso")]
                                }
                              } on-error={}
                              :if (([:len $iataLoc] > 0) and ($iataLoc != "nil")) do={ :set iso ($iataLoc . " (" . $iata . ")") } else={
                                :if (([:len $ctry] > 0) and ($ctry != "nil")) do={ :set iso ($ctry . " (" . $iata . ")") } else={ :set iso ("N/A (" . $iata . ")") }
                              }
                            } else={
                              :if (([:len $ctry] > 0) and ($ctry != "nil")) do={ :set iso $ctry } else={ :set iso "N/A" }
                            }
                          }
                          :if (([:len $iso] = 0) or ($iso = "nil")) do={ :set iso "N/A" }
                        } on-error={
                          :set iso "Server error"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  :put ($name . " " . $iso)
  :set itemJson ("{\"service\":\"" . $name . "\",\"ipv4\":\"" . $iso . "\"}")
  :if ([:len $resultJson] > 0) do={ :set resultJson ($resultJson . ",") }
  :set resultJson ($resultJson . $itemJson)
}

:local hosterJson ""
:if ([:len $hoster] > 0) do={
  :local esc ""
  :local hi 0
  :while ($hi < [:len $hoster]) do={
    :local ch [:pick $hoster $hi ($hi + 1)]
    :if ($ch = "\\") do={ :set esc ($esc . "\\\\") } else={
      :if ($ch = "\"") do={ :set esc ($esc . "\\\"") } else={ :set esc ($esc . $ch) }
    }
    :set hi ($hi + 1)
  }
  :set hosterJson (",\"hoster\":\"" . $esc . "\"")
}
:if ([:len $resultJson] = 0) do={ :error "ingest: results пустой" }
:local json ("{\"schemaVersion\":1,\"runId\":\"" . $runId . "\",\"probe\":{\"publicIp\":\"" . $publicIp . "\"" . $hosterJson . "},\"launcherVersion\":\"" . $launcherVer . "\",\"ipregion\":{\"version\":\"ros\"},\"results\":[" . $resultJson . "]}")
:local hdrs ("Content-Type: application/json,Authorization: Bearer " . $vtToken)
:put ("Отправляю ingest (" . [:len $json] . " B)...")
:set ingestOk false
:onerror err,attr in={
  :set r [/tool fetch url=($vtApi . "/api/integrations/ipregion/runs") src-address=$srcIp http-method=post http-header-field=$hdrs http-data=$json output=user as-value]
  :put ($r->"data")
  :set ingestOk true
} do={
  :put ("ingest: " . $err)
  :if (([:typeof $attr] = "array") and ([:typeof ($attr->"code")] != "nil")) do={
    :put ("code: " . ($attr->"code"))
  }
  :if (([:typeof $attr] = "array") and ([:typeof ($attr->"data")] = "str") and ([:len ($attr->"data")] > 0)) do={
    :put ($attr->"data")
  }
  :if ([:len $json] > 120) do={ :put ([:pick $json 0 120] . "...") } else={ :put $json }
}
:if ($ingestOk = false) do={
  :put "повтор ingest без src-address..."
  :onerror err2,attr2 in={
    :set r [/tool fetch url=($vtApi . "/api/integrations/ipregion/runs") http-method=post http-header-field=$hdrs http-data=$json output=user as-value]
    :put ($r->"data")
  } do={
    :put ("ingest retry: " . $err2)
    :if (([:typeof $attr2] = "array") and ([:typeof ($attr2->"data")] = "str") and ([:len ($attr2->"data")] > 0)) do={
      :put ($attr2->"data")
    }
    :if ([:len $json] > 120) do={ :put ([:pick $json 0 120] . "...") } else={ :put $json }
  }
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
  :local ev (":global \"vt-srcIp\" \"" . $srcIp . "\"; /tool fetch url=" . $vtApi . "/ic.rsc dst-path=" . $dstFile . "; /import file-name=" . $dstFile)
  :do { /system scheduler remove [find name=$schedName] } on-error={}
  /system scheduler add name=$schedName interval=1d start-time=$startTime on-event=$ev policy=read,write,test,policy comment="vps-tracker vt-ic"
  :put ("Ежедневная проверка: каждый день в " . $startTime . " (" . $schedName . ")")
  :put ("Снять: /tool fetch url=" . $vtApi . "/ic.rsc?remove=daily dst-path=" . $dstFile . "; /import file-name=" . $dstFile)
}

}
