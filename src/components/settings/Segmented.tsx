import React from 'react';

interface SegmentedProps<T extends string | number | boolean> {
    options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
    value: T;
    onChange: (value: T) => void;
    label: string;
}

/** Переключатель-сегмент с бегущей подложкой: один вариант из нескольких. */
export function Segmented<T extends string | number | boolean>({ options, value, onChange, label }: SegmentedProps<T>) {
    const index = Math.max(0, options.findIndex(o => o.value === value));
    return (
        <div className="segmented" role="radiogroup" aria-label={label} style={{ ['--count' as any]: options.length, ['--index' as any]: index }}>
            <span className="segmented-thumb" aria-hidden />
            {options.map(option => (
                <button
                    key={String(option.value)}
                    role="radio"
                    aria-checked={option.value === value}
                    className={`segmented-option ${option.value === value ? 'is-active' : ''}`}
                    onClick={() => onChange(option.value)}
                >
                    {option.icon}
                    <span>{option.label}</span>
                </button>
            ))}
        </div>
    );
}

/** Строка настройки: подпись слева, элемент справа. */
export const SettingLine: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="setting-line">
        <span className="setting-line-label">{label}</span>
        {children}
    </div>
);
