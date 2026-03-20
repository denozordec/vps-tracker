/**
 * Database migrations — add columns to existing tables
 */

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
]
