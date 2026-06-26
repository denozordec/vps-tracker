/**
 * Database migrations — add columns to existing tables
 */

import { randomUUID } from 'node:crypto'

/**
 * Перенос apiType/apiBaseUrl с аккаунтов на хостера (idempotent).
 * Вызывается из миграции и после импорта бэкапа / старого migrate API.
 * @param {import('sql.js').Database} db
 */
function selectAllObjects(db, sql, params = []) {
  const prepared = db.prepare(sql)
  if (typeof prepared.all === 'function') {
    return prepared.all(...params)
  }
  const stmt = prepared
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

export function consolidateProviderApiFromAccounts(db) {
  const provRows = selectAllObjects(db, 'SELECT id, apiType, apiBaseUrl FROM providers')
  for (const prov of provRows) {
    const pid = prov.id
    if (String(prov.apiType || '').trim() || String(prov.apiBaseUrl || '').trim()) {
      continue
    }
    const accRows = selectAllObjects(
      db,
      `SELECT apiBaseUrl FROM provider_accounts
       WHERE providerId = ?
         AND length(trim(COALESCE(apiBaseUrl, ''))) > 0
         AND (
           lower(trim(COALESCE(apiType, ''))) = 'billmanager'
           OR instr(lower(trim(COALESCE(apiBaseUrl, ''))), 'billmgr') > 0
         )
       ORDER BY id`,
      [pid],
    )
    if (!accRows.length) continue
    const urls = [...new Set(accRows.map((r) => String(r.apiBaseUrl || '').trim()).filter(Boolean))]
    if (urls.length > 1) {
      console.warn(
        `[vps-tracker] У хостера ${pid} у нескольких аккаунтов разный URL BILLmanager — в настройках хостера взят первый.`,
      )
    }
    const apiBaseUrl = urls[0]
    db.run(`UPDATE providers SET apiType = ?, apiBaseUrl = ? WHERE id = ?`, 'billmanager', apiBaseUrl, pid)
    db.run(
      `UPDATE provider_accounts SET apiType = '', apiBaseUrl = ''
       WHERE providerId = ?
         AND length(trim(COALESCE(apiBaseUrl, ''))) > 0
         AND (
           lower(trim(COALESCE(apiType, ''))) = 'billmanager'
           OR instr(lower(trim(COALESCE(apiBaseUrl, ''))), 'billmgr') > 0
         )`,
      pid,
    )
  }
}

/**
 * Раньше URL BILLmanager часто указывали в «Сайт» хостера или в panelUrl аккаунта, без apiType/apiBaseUrl.
 */
export function heuristicBillmanagerProviderApi(db) {
  const tryBillmgrUrl = (raw) => {
    const t = String(raw || '').trim()
    if (!t) return ''
    if (!/^https?:\/\//i.test(t)) return ''
    if (!/billmgr/i.test(t)) return ''
    return t.replace(/\/+$/, '')
  }

  const provRows = selectAllObjects(db, 'SELECT id, website, apiType, apiBaseUrl FROM providers')
  for (const prov of provRows) {
    if (String(prov.apiType || '').trim() || String(prov.apiBaseUrl || '').trim()) continue

    let url = tryBillmgrUrl(prov.website)
    if (!url) {
      const accRows = selectAllObjects(
        db,
        `SELECT panelUrl FROM provider_accounts
         WHERE providerId = ? AND length(trim(COALESCE(panelUrl, ''))) > 0
         ORDER BY id`,
        [prov.id],
      )
      for (const row of accRows) {
        url = tryBillmgrUrl(row.panelUrl)
        if (url) break
      }
    }
    if (url) {
      db.run(`UPDATE providers SET apiType = ?, apiBaseUrl = ? WHERE id = ?`, 'billmanager', url, prov.id)
    }
  }
}

/** Перенос API на хостера: с аккаунтов + эвристика по website/panelUrl. */
export function consolidateAllProviderApiSources(db) {
  consolidateProviderApiFromAccounts(db)
  heuristicBillmanagerProviderApi(db)
}

export const MIGRATIONS = [
  {
    name: 'provider_accounts_api',
    run(db) {
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN apiType TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN apiBaseUrl TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN apiCredentials TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'settings_sync',
    run(db) {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN syncEnabled INTEGER')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE settings ADD COLUMN syncIntervalMinutes INTEGER')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'vps_paidUntil',
    run(db) {
      try {
        db.exec('ALTER TABLE vps ADD COLUMN paidUntil TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'provider_accounts_balance_api',
    run(db) {
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN balance_api REAL')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN balance_currency TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN balance_updated_at TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN enoughmoneyto TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'vps_userOverrides',
    run(db) {
      try {
        db.exec('ALTER TABLE vps ADD COLUMN userOverrides TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'active_tariffs_location_cpu',
    run(db) {
      try {
        db.exec('ALTER TABLE active_tariffs ADD COLUMN location TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE active_tariffs ADD COLUMN cpuModel TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'settings_customFields',
    run(db) {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN customFields TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'settings_syncTariffsInterval',
    run(db) {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN syncTariffsIntervalMinutes INTEGER')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'active_tariffs_country_datacenter',
    run(db) {
      try {
        db.exec('ALTER TABLE active_tariffs ADD COLUMN country TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE active_tariffs ADD COLUMN datacenterKey TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE active_tariffs ADD COLUMN datacenterName TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'settings_telegram',
    run(db) {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN telegramBotToken TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE settings ADD COLUMN telegramChatId TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE settings ADD COLUMN notifyPaymentExpiryEnabled INTEGER')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE settings ADD COLUMN notifyNewTariffsEnabled INTEGER')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'settings_telegram_thread',
    run(db) {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN telegramMessageThreadId TEXT')
      } catch (e) {
        if (!e.message?.includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'server_projects',
    run(db) {
      db.run(
        `CREATE TABLE IF NOT EXISTS server_projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          sortOrder INTEGER DEFAULT 0,
          notes TEXT,
          createdAt TEXT
        )`,
      )
      try {
        db.run('ALTER TABLE vps ADD COLUMN projectId TEXT')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }

      const distinctStmt = db.prepare(
        `SELECT DISTINCT trim(project) AS n FROM vps WHERE length(trim(COALESCE(project, ''))) > 0`,
      )
      const seenLower = new Set()
      const findStmt = db.prepare(
        'SELECT id FROM server_projects WHERE LOWER(name) = LOWER(?) LIMIT 1',
      )
      while (distinctStmt.step()) {
        const row = distinctStmt.getAsObject()
        const t = String(row.n ?? '').trim()
        if (!t) continue
        const lk = t.toLowerCase()
        if (seenLower.has(lk)) continue
        seenLower.add(lk)

        findStmt.bind([t])
        const exists = Boolean(findStmt.step())
        findStmt.reset()
        if (!exists) {
          const id = `proj-${randomUUID()}`
          const now = new Date().toISOString()
          db.run(
            `INSERT INTO server_projects (id, name, color, sortOrder, notes, createdAt) VALUES (?, ?, NULL, 0, NULL, ?)`,
            [id, t, now],
          )
        }
      }
      distinctStmt.free()
      findStmt.free()

      db.run(`UPDATE vps SET projectId = (
        SELECT sp.id FROM server_projects sp
        WHERE LOWER(sp.name) = LOWER(trim(COALESCE(vps.project, '')))
        LIMIT 1
      ) WHERE length(trim(COALESCE(vps.project, ''))) > 0`)
    },
  },
  {
    name: 'sync_log_summary',
    run(db) {
      try {
        db.exec('ALTER TABLE sync_log ADD COLUMN summary TEXT')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'settings_notify_balance_digest',
    run(db) {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN notifyLowBalanceEnabled INTEGER')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE settings ADD COLUMN notifySyncDigestEnabled INTEGER')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'provider_accounts_balance_alert_below',
    run(db) {
      try {
        db.exec('ALTER TABLE provider_accounts ADD COLUMN balance_alert_below REAL')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }
    },
  },
  {
    name: 'providers_api_integration',
    run(db) {
      try {
        db.exec('ALTER TABLE providers ADD COLUMN apiType TEXT')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }
      try {
        db.exec('ALTER TABLE providers ADD COLUMN apiBaseUrl TEXT')
      } catch (e) {
        if (!String(e.message || e).includes('duplicate column')) throw e
      }
      consolidateAllProviderApiSources(db)
    },
  },
]
