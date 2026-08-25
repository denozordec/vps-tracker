import type { ComponentType, SVGProps } from 'react'
import {
  AppWindowIcon,
  BinaryIcon,
  CircleHelpIcon,
  ClapperboardIcon,
  CodeXmlIcon,
  DatabaseIcon,
  EarthIcon,
  FileJsonIcon,
  FlagIcon,
  GlobeIcon,
  InfoIcon,
  LayersIcon,
  LibraryIcon,
  MapIcon,
  MapPinIcon,
  MapPinnedIcon,
  NetworkIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  siApple,
  siCloudflare,
  siGoogle,
  siGooglegemini,
  siJetbrains,
  siNetflix,
  siPlaystation,
  siReddit,
  siSpeedtest,
  siSpotify,
  siSteam,
  siTiktok,
  siTwitch,
  siYoutube,
  type SimpleIcon,
} from 'simple-icons'

import { cn } from '@cfdm/ui/lib/utils'

function BrandGlyph({
  icon,
  className,
}: {
  icon: SimpleIcon
  className?: string
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={cn('size-3.5 shrink-0', className)}
      aria-hidden
    >
      <title>{icon.title}</title>
      <path fill="currentColor" d={icon.path} />
    </svg>
  )
}

function brandComponent(icon: SimpleIcon): ComponentType<{ className?: string }> {
  function BrandIcon({ className }: { className?: string }) {
    return <BrandGlyph icon={icon} className={className} />
  }
  BrandIcon.displayName = `BrandIcon(${icon.slug})`
  return BrandIcon
}

const BRAND_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'cloudflare.com': brandComponent(siCloudflare),
  'cloudflare cdn': brandComponent(siCloudflare),
  google: brandComponent(siGoogle),
  'google search captcha': brandComponent(siGoogle),
  youtube: brandComponent(siYoutube),
  'youtube premium': brandComponent(siYoutube),
  'youtube cdn': brandComponent(siYoutube),
  twitch: brandComponent(siTwitch),
  netflix: brandComponent(siNetflix),
  'netflix cdn': brandComponent(siNetflix),
  spotify: brandComponent(siSpotify),
  'spotify signup': brandComponent(siSpotify),
  reddit: brandComponent(siReddit),
  'reddit (guest access)': brandComponent(siReddit),
  apple: brandComponent(siApple),
  steam: brandComponent(siSteam),
  tiktok: brandComponent(siTiktok),
  jetbrains: brandComponent(siJetbrains),
  playstation: brandComponent(siPlaystation),
  'gemini supported': brandComponent(siGooglegemini),
  'ookla speedtest': brandComponent(siSpeedtest),
}

const GENERIC_ICONS: Record<string, LucideIcon> = {
  'maxmind.com': DatabaseIcon,
  'rdap.db.ripe.net': NetworkIcon,
  'ipinfo.io': InfoIcon,
  'ipregistry.co': LibraryIcon,
  'ipapi.co': CodeXmlIcon,
  'ifconfig.co': TerminalIcon,
  'ip2location.io': MapPinnedIcon,
  'iplocation.com': MapIcon,
  'country.is': FlagIcon,
  'geoapify.com': MapPinIcon,
  'geojs.io': FileJsonIcon,
  'ipapi.is': BinaryIcon,
  'ipbase.com': LayersIcon,
  'ipquery.io': SearchIcon,
  'ipwho.is': CircleHelpIcon,
  'ip-api.com': EarthIcon,
  chatgpt: SparklesIcon,
  'disney+': ClapperboardIcon,
  'disney+ access': ClapperboardIcon,
  microsoft: AppWindowIcon,
}

export function resolveServiceIcon(
  serviceKey: string,
): ComponentType<SVGProps<SVGSVGElement> & { className?: string }> {
  const key = serviceKey.trim().toLowerCase()
  return BRAND_ICONS[key] ?? GENERIC_ICONS[key] ?? GlobeIcon
}

export function ServiceGlyph({
  serviceKey,
  className,
}: {
  serviceKey: string
  className?: string
}) {
  const Icon = resolveServiceIcon(serviceKey)
  return <Icon className={cn('size-3.5 shrink-0', className)} />
}
