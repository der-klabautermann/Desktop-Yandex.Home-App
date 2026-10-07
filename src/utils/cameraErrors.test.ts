import { describe, expect, it } from 'vitest';
import { describeCameraError } from './cameraErrors';

const t = (key: string) => `[${key}]`;

describe('describeCameraError', () => {
  it('erkennt eigene Codes', () => {
    expect(describeCameraError('CAM_TOO_MANY', t)).toBe('[camera.errors.tooMany]');
    expect(describeCameraError('CAM_CONNECT_FAILED', t)).toBe('[camera.errors.connect]');
    expect(describeCameraError('CAM_NO_VIDEO', t)).toBe('[camera.errors.privacy]');
  });
  it('erkennt russische Meldungen des Hauptprozesses', () => {
    expect(describeCameraError('Камера не найдена в Quasar API', t)).toBe('[camera.errors.notFound]');
    expect(describeCameraError('URL видеопотока не получен', t)).toBe('[camera.errors.noStream]');
    expect(describeCameraError('Quasar auth: неполный ответ passport', t)).toBe('[errors.xTokenRequired]');
    expect(describeCameraError('Устройство не умеет это', t)).toBe('[camera.errors.privacy]');
  });
  it('Serverfehler behält den Grund', () => {
    expect(describeCameraError('CAM_SERVER_ERROR room closed', t)).toBe('[camera.errors.server] (room closed)');
  });
  it('unbekannte Meldung wird allgemeiner Fehler mit Detail', () => {
    expect(describeCameraError('kaputt', t)).toBe('[camera.errors.generic] (kaputt)');
  });
});
