import type { BillmanagerProfileOverrides } from './types.js'

/**
 * Waicore (my.waicore.com) — list VPS via func=vds.vps instead of vds.
 * Response uses top-level elem[] (covered by extractList).
 */
export const waicoreOverrides: BillmanagerProfileOverrides = {
  id: 'waicore',
  match: {
    hostnames: ['waicore.com', 'waicore.network'],
    keywords: ['waicore'],
  },
  funcs: {
    listVds: 'vds.vps',
  },
}
