import type { RawData } from 'ws';

import { type ClientMessage, isClientMessage } from '../shared/network-protocol';

export function parseClientMessage(data: RawData): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(data.toString());
    return isClientMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
