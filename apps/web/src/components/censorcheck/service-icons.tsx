import type { ComponentType, SVGProps } from 'react'
import {
  BookOpenIcon,
  BoxIcon,
  BugIcon,
  ClapperboardIcon,
  DownloadIcon,
  FileJsonIcon,
  GlobeIcon,
  HeartIcon,
  KeyRoundIcon,
  LinkedinIcon,
  MailIcon,
  ScrollTextIcon,
  ShieldIcon,
  SparklesIcon,
  VideoIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  siDigitalocean,
  siDiscord,
  siFacebook,
  siGoogleplay,
  siInstagram,
  siMongodb,
  siNetflix,
  siRedis,
  siSpotify,
  siTelegram,
  siX,
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
  'discord.com': brandComponent(siDiscord),
  'youtube.com': brandComponent(siYoutube),
  'instagram.com': brandComponent(siInstagram),
  'facebook.com': brandComponent(siFacebook),
  'x.com': brandComponent(siX),
  'api.telegram.org': brandComponent(siTelegram),
  'spotify.com': brandComponent(siSpotify),
  'netflix.com': brandComponent(siNetflix),
  'mongodb.com': brandComponent(siMongodb),
  'redis.io': brandComponent(siRedis),
  'digitalocean.com': brandComponent(siDigitalocean),
  'play.google.com': brandComponent(siGoogleplay),
}

const GENERIC_ICONS: Record<string, LucideIcon> = {
  'linkedin.com': LinkedinIcon,
  'redirector.googlevideo.com': VideoIcon,
  'rutracker.org': DownloadIcon,
  'amnezia.org': ShieldIcon,
  'getoutline.org': KeyRoundIcon,
  'mailfence.com': MailIcon,
  'flibusta.is': BookOpenIcon,
  'rezka.ag': ClapperboardIcon,
  'patreon.com': HeartIcon,
  'swagger.io': FileJsonIcon,
  'snyk.io': BugIcon,
  'autodesk.com': BoxIcon,
  'graylog.org': ScrollTextIcon,
  'copilot.microsoft.com': SparklesIcon,
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
