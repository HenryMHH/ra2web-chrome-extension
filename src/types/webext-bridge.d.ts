import 'webext-bridge'

declare module 'webext-bridge' {
  export interface ProtocolMap {
    'ra2:apply': { data: any, return: any }
    'ra2:status': { data: undefined, return: any }
    'ra2:getUnitNames': { data: undefined, return: any }
  }
}
