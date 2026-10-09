import React from 'react';

/**
 * Горы и лес внизу боковой панели. Цвета из CSS (день и ночь задаёт data-daylight на <html>),
 * поэтому пейзаж меняется вместе с темой и временем суток без картинок.
 */
export const SidebarLandscape: React.FC = () => (
    <svg className="sidebar-landscape-art" viewBox="0 0 260 220" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
            <linearGradient id="sl-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--land-sky-top)" stopOpacity="0" />
                <stop offset="0.45" stopColor="var(--land-sky-mid)" stopOpacity="0.85" />
                <stop offset="1" stopColor="var(--land-sky-low)" />
            </linearGradient>
            <radialGradient id="sl-glow" cx="0.72" cy="0.42" r="0.35">
                <stop offset="0" stopColor="var(--land-glow)" stopOpacity="0.55" />
                <stop offset="1" stopColor="var(--land-glow)" stopOpacity="0" />
            </radialGradient>
        </defs>
        <rect width="260" height="220" fill="url(#sl-sky)" />
        <rect width="260" height="220" fill="url(#sl-glow)" />
        <g className="sidebar-landscape-stars" fill="var(--land-star)">
            <circle cx="30" cy="70" r="0.9" /><circle cx="58" cy="52" r="0.7" /><circle cx="96" cy="78" r="0.8" />
            <circle cx="140" cy="48" r="0.6" /><circle cx="210" cy="66" r="0.8" /><circle cx="236" cy="44" r="0.6" />
        </g>
        {/* Дальние хребты */}
        <path d="M0 150 L28 128 L52 140 L84 108 L112 132 L140 116 L170 136 L204 104 L232 126 L260 112 L260 220 L0 220 Z" fill="var(--land-far)" />
        <path d="M0 168 L34 146 L60 160 L96 134 L126 156 L160 140 L196 162 L226 142 L260 156 L260 220 L0 220 Z" fill="var(--land-mid)" />
        {/* Еловый лес на переднем плане */}
        <g fill="var(--land-near)">
            <path d="M0 220 L0 182 L260 178 L260 220 Z" />
            {[8, 22, 36, 54, 70, 88, 104, 122, 138, 156, 172, 190, 206, 224, 240, 254].map((x, i) => {
                const h = 22 + ((i * 7) % 13);
                const base = 186 - ((i * 5) % 6);
                return <path key={x} d={`M${x} ${base - h} L${x + 7} ${base} L${x - 7} ${base} Z`} />;
            })}
        </g>
    </svg>
);
