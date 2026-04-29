// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAvailableMonths(): any[] { return [] }
export function getMonthAudits(..._args: any[]): any[] { return [] }
export function buildMonthRange(..._args: any[]): any[] { return [] }
export function getMonthlyAverages(..._args: any[]): any[] { return [] }
export function getFilteredAuditIds(..._args: any[]): any { return { auditIds: [], totalAudits: 0, jzOptions: [], vendedorOptions: [], categoriaOptions: [] } }
export function getAnswers(..._args: any[]): any[] { return [] }
export function countAnswers(..._args: any[]): any { return { length: 0 } }
export function getAuditLocations(..._args: any[]): any[] { return [] }
export function defaultMonth(): string { return new Date().toISOString().slice(0, 7) }
