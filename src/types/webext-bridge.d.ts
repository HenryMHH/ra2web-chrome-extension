import 'webext-bridge'

declare module 'webext-bridge' {
  export interface ProtocolMap {
    'ra2:apply': any
    'ra2:status': any
    'ra2:getUnitNames': any
  }
}
