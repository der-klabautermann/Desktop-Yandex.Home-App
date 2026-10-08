// Home Assistant как сервис: адрес сервера и долгосрочный токен доступа.
// Через него подключаются Xiaomi (официальная интеграция «Xiaomi Home» в HA) и другие марки.
import { buildHomeAssistantHome, serviceForAction, serviceForToggle, type HaEntityLink, type HaServiceCall, type HaState } from './translate';
import type { CredentialStore, Provider } from '../../provider';

export const HOME_ASSISTANT_ACCOUNT = 'provider:homeassistant';

interface HaCredentials { url: string; token: string }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Адрес без лишнего: добавляем http:// и убираем / в конце. */
export const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
};

// Шаблон Jinja: зоны (areas) и для каждой сущности её зона и устройство. Ответ — JSON.
export const LINKS_TEMPLATE = `{%- set ns = namespace(areas=[], ents=[]) -%}
{%- for a in areas() -%}{%- set ns.areas = ns.areas + [{"id": a, "name": area_name(a)}] -%}{%- endfor -%}
{%- for s in states -%}{%- set d = device_id(s.entity_id) -%}
{%- set ns.ents = ns.ents + [{"e": s.entity_id, "a": area_id(s.entity_id), "d": d, "dn": (device_attr(d, "name_by_user") or device_attr(d, "name")) if d else none}] -%}
{%- endfor -%}
{{ {"areas": ns.areas, "entities": ns.ents} | tojson }}`;

export const createHomeAssistantProvider = (
  store: CredentialStore,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Provider => {
  const request = async <T>(credentials: HaCredentials, path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
    let response: Response;
    try {
      response = await fetchImpl(`${credentials.url}${path}`, {
        method: init?.method ?? 'GET',
        headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new Error('ERR_NETWORK');
    }
    if (response.status === 401 || response.status === 403) throw new Error('ERR_AUTH');
    if (!response.ok) throw new Error(`ERR_HTTP ${response.status}`);
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  };

  const load = async (): Promise<HaCredentials> => {
    const raw = await store.get(HOME_ASSISTANT_ACCOUNT);
    if (!raw) throw new Error('ERR_AUTH');
    try {
      return JSON.parse(raw) as HaCredentials;
    } catch {
      throw new Error('ERR_AUTH');
    }
  };

  const callService = async (call: HaServiceCall) =>
    request(await load(), `/api/services/${call.domain}/${call.service}`, { method: 'POST', body: call.data });

  return {
    id: 'homeassistant',

    async isConfigured() {
      return Boolean(await store.get(HOME_ASSISTANT_ACCOUNT));
    },

    async connect(payload) {
      const credentials = { url: normalizeUrl(payload.url ?? ''), token: (payload.token ?? '').trim() };
      if (!credentials.url || !credentials.token) throw new Error('ERR_HA_INPUT');
      // /api/ отвечает «API running.», если адрес и токен верны
      await request(credentials, '/api/');
      await store.set(HOME_ASSISTANT_ACCOUNT, JSON.stringify(credentials));
    },

    async disconnect() {
      await store.delete(HOME_ASSISTANT_ACCOUNT);
    },

    async loadHome() {
      const credentials = await load();
      const [config, states, links] = await Promise.all([
        request<{ location_name?: string }>(credentials, '/api/config'),
        request<HaState[]>(credentials, '/api/states'),
        request<{ areas: Array<{ id: string; name: string }>; entities: HaEntityLink[] }>(credentials, '/api/template', {
          method: 'POST', body: { template: LINKS_TEMPLATE },
        }),
      ]);
      return buildHomeAssistantHome({
        locationName: config.location_name ?? 'Home Assistant',
        areas: links.areas ?? [],
        entities: links.entities ?? [],
        states,
      });
    },

    async toggleDevice(deviceId, newState) {
      await callService(serviceForToggle(deviceId, newState));
    },

    async setDeviceMode(deviceId, actions, turnOn) {
      if (turnOn) await callService(serviceForToggle(deviceId, true));
      for (const action of actions) {
        const call = serviceForAction(deviceId, action);
        if (call) await callService(call);
      }
    },

    async toggleGroup(_groupId, deviceIds, newState) {
      for (const deviceId of deviceIds) await callService(serviceForToggle(deviceId, newState));
    },

    async runScenario(scenarioId) {
      await callService(serviceForToggle(scenarioId, true));
    },
  };
};
