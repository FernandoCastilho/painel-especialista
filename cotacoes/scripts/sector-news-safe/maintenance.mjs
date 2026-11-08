import { readFileSync } from 'node:fs'
export function parserMaintenanceEnabled() {
  const config = JSON.parse(readFileSync(new URL('./maintenance-config.json', import.meta.url), 'utf8'))
  if (!config || Object.keys(config).sort().join('|') !== 'enabled|schemaVersion' || config.schemaVersion !== 1 || typeof config.enabled !== 'boolean') throw Error('maintenance_configuration_invalid')
  return config.enabled
}
