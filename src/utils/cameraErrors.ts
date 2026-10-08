import type { Translate } from '../i18n/core';

/**
 * Понятный текст ошибки камеры на выбранном языке.
 * Рендерер сообщает коды CAM_*, главный процесс пока присылает русские тексты,
 * поэтому знакомые фразы тоже распознаются.
 */
const RULES: Array<{ test: RegExp; key: string }> = [
  { test: /ERR_UNREACHABLE/, key: 'camera.errors.unreachable' },
  { test: /CAM_PRIVACY_TOGGLE|изменить режим приватности/i, key: 'camera.errors.privacyToggle' },
  { test: /CAM_TOO_MANY|слишком много|too.?many/i, key: 'camera.errors.tooMany' },
  { test: /CAM_NO_VIDEO|приват|не умеет/i, key: 'camera.errors.privacy' },
  { test: /CAM_CONNECT_FAILED|WebSocket|WebRTC-подключ/i, key: 'camera.errors.connect' },
  { test: /CAM_HLS_FAILED|CAM_FORMAT/, key: 'camera.errors.playback' },
  { test: /X_TOKEN|Quasar auth|Требуется вход|QR/i, key: 'errors.xTokenRequired' },
  { test: /не найдена/i, key: 'camera.errors.notFound' },
  { test: /видеопоток|CAM_NO_STREAM/i, key: 'camera.errors.noStream' },
];

export function describeCameraError(message: string, t: Translate): string {
  const server = /^CAM_SERVER_ERROR\s*(.*)$/.exec(message);
  if (server) return server[1] ? `${t('camera.errors.server')} (${server[1]})` : t('camera.errors.server');
  const rule = RULES.find(r => r.test.test(message));
  if (rule) return t(rule.key);
  return message ? `${t('camera.errors.generic')} (${message})` : t('camera.errors.generic');
}
