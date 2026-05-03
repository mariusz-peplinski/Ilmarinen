import { describe, expect, it } from 'vitest'

import { NETWORK_PROTOCOL_VERSION } from '../shared/network-protocol'
import { parseClientMessage } from './client-message-parser'

describe('parseClientMessage', () => {
  it('parses valid JSON client messages', () => {
    const message = parseClientMessage(Buffer.from(JSON.stringify({
      type: 'hello',
      name: 'Server Tester',
      protocolVersion: NETWORK_PROTOCOL_VERSION
    })))

    expect(message).toEqual({
      type: 'hello',
      name: 'Server Tester',
      protocolVersion: NETWORK_PROTOCOL_VERSION
    })
  })

  it('returns null for invalid JSON or invalid message shapes', () => {
    expect(parseClientMessage(Buffer.from('{nope'))).toBeNull()
    expect(parseClientMessage(Buffer.from(JSON.stringify({ type: 'dance' })))).toBeNull()
    expect(parseClientMessage(Buffer.from(JSON.stringify({
      type: 'playerSnapshot',
      mapId: 'overworld'
    })))).toBeNull()
  })
})
