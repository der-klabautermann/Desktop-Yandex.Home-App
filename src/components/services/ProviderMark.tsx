import React from 'react';
import { providerInfo } from './providers';

/** Круглая плашка сервиса с его меткой и фирменным цветом. */
export const ProviderMark: React.FC<{ id: string; size?: number }> = ({ id, size = 40 }) => {
  const info = providerInfo(id);
  return (
    <span className="provider-mark" style={{ width: size, height: size, fontSize: size * 0.36, ['--mark' as string]: info.color }}>
      {info.badge}
    </span>
  );
};
