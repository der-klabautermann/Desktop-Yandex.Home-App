import { describe, expect, it } from 'vitest';
import { cleanErrorMessage } from './errors';

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `[${key} ${JSON.stringify(vars)}]` : `[${key}]`;

describe('cleanErrorMessage', () => {
  it('übersetzt bekannte Codes', () => {
    const err = new Error("Error invoking remote method 'yandex-api:fetchUserInfo': Error: ERR_AUTH");
    expect(cleanErrorMessage(err, t)).toBe('[errors.auth]');
  });
  it('übersetzt Netzwerkfehler', () => {
    expect(cleanErrorMessage(new Error('ERR_NETWORK'), t)).toBe('[errors.network]');
  });
  it('HTTP-Status wird allgemeiner Fehler', () => {
    expect(cleanErrorMessage(new Error('ERR_HTTP 500'), t)).toBe('[errors.request]');
  });
  it('nicht erreichbares Gerät', () => {
    expect(cleanErrorMessage(new Error('ERR_DEVICE DEVICE_UNREACHABLE'), t)).toBe('[errors.deviceUnreachable]');
  });
  it('sonstiger Gerätefehler behält das Detail', () => {
    expect(cleanErrorMessage(new Error('ERR_DEVICE INVALID_VALUE'), t)).toBe('[errors.device {"detail":"INVALID_VALUE"}]');
  });
  it('unbekannter Typ', () => {
    expect(cleanErrorMessage('kaputt', t)).toBe('[errors.unknown]');
  });
  it('fremder Text bleibt erhalten', () => {
    expect(cleanErrorMessage(new Error('Something specific'), t)).toBe('Something specific');
  });
});
