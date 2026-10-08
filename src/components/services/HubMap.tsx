import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { AccountSummary } from '../../types/electron-api';
import { providerInfo } from './providers';

const WIDTH = 520;
const HEIGHT = 190;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

/** Схема: центр приложения и подключённые сервисы вокруг, линия показывает состояние связи. */
export const HubMap: React.FC<{ accounts: AccountSummary[] }> = ({ accounts }) => {
  const { t } = useI18n();
  // Сервисы раскладываем полукругом слева и справа от центра
  const nodes = accounts.map((account, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const spread = Math.max(1, Math.ceil(accounts.length / 2));
    const y = spread === 1 ? CENTER.y : 34 + (row * (HEIGHT - 68)) / (spread - 1);
    return { account, x: CENTER.x + side * (150 + (row % 2) * 30), y };
  });

  return (
    <div className="hub-map" aria-hidden>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="hub-core" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        {nodes.map(({ account, x, y }) => (
          <path
            key={`line-${account.providerId}`}
            className={`hub-link is-${account.status}`}
            d={`M ${CENTER.x} ${CENTER.y} C ${(CENTER.x + x) / 2} ${CENTER.y}, ${(CENTER.x + x) / 2} ${y}, ${x} ${y}`}
          />
        ))}
        <circle className="hub-halo" cx={CENTER.x} cy={CENTER.y} r={50} />
        <circle cx={CENTER.x} cy={CENTER.y} r={36} fill="url(#hub-core)" />
        <text className="hub-core-label" x={CENTER.x} y={CENTER.y + 4} textAnchor="middle">{t('services.hub')}</text>
        {nodes.map(({ account, x, y }) => {
          const info = providerInfo(account.providerId);
          return (
            <g key={`node-${account.providerId}`} className={`hub-node is-${account.status}`}>
              <circle cx={x} cy={y} r={20} fill={info.color} />
              <text x={x} y={y + 4.5} textAnchor="middle" className="hub-node-badge">{info.badge}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
