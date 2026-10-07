// Цветовые темы приложения. Каждая тема — набор CSS-переменных поверх
// базовой светлой или тёмной темы из index.css.

export type PaletteId = 'volna' | 'alisa' | 'muzyka' | 'dom' | 'gorod' | 'plus' | 'biryuza';

export interface Palette {
    id: PaletteId;
    base: 'light' | 'dark';
    /** Цвета для превью в выборе темы: фон, два цвета свечения, "горящее" устройство. */
    swatch: [string, string, string, string];
    tokens: Record<string, string>;
}

/** Описание темы в нескольких цветах; остальные переменные выводятся из них. */
interface PaletteSpec {
    base: 'light' | 'dark';
    bg: string;
    surface: string;
    fg: string;
    fg2: string;
    muted: string;
    border: string;
    /** RGB без альфы, например "255, 255, 255": цвет стеклянных линий и карточек. */
    glassRgb: string;
    accent: string;
    accentOn: string;
    accentHover: string;
    /** "Горящая" карточка включённого устройства и её текст. */
    lit: string;
    litFg: string;
    /** RGB свечения включённого устройства. */
    glowRgb: string;
    iconBg: string;
    iconFg: string;
    toggle: string;
    star: string;
    auroraA: string;
    auroraB: string;
    auroraC: string;
}

const build = (spec: PaletteSpec): Record<string, string> => {
    const dark = spec.base === 'dark';
    return {
        '--app-bg': spec.bg, '--bg': spec.bg,
        '--sidebar-bg': dark ? `color-mix(in oklab, ${spec.bg} 55%, transparent)` : `rgba(${spec.glassRgb}, 0.55)`,
        '--surface': spec.surface,
        '--surface-warm': `color-mix(in oklab, ${spec.surface} 60%, ${spec.bg})`,
        '--card-bg': dark ? `rgba(${spec.glassRgb}, 0.045)` : `rgba(${spec.glassRgb}, 0.62)`,
        '--group-bg': dark ? `rgba(${spec.glassRgb}, 0.03)` : `rgba(${spec.glassRgb}, 0.40)`,
        '--card-fg': spec.fg, '--fg': spec.fg, '--fg-2': spec.fg2,
        '--muted': spec.muted, '--meta': spec.muted,
        '--border': spec.border, '--border-soft': `color-mix(in oklab, ${spec.border} 60%, ${spec.bg})`,
        '--card-bg-active': spec.lit, '--card-fg-active': spec.litFg,
        '--accent': spec.accent, '--accent-on': spec.accentOn,
        '--accent-hover': spec.accentHover, '--accent-active': spec.accentHover,
        '--toggle-on': spec.toggle, '--success': spec.toggle, '--fav-star': spec.star,
        '--aurora-a': spec.auroraA, '--aurora-b': spec.auroraB, '--aurora-c': spec.auroraC,
        '--glass-line': dark ? `rgba(${spec.glassRgb}, 0.09)` : 'rgba(20, 20, 40, 0.08)',
        '--glass-line-strong': dark ? `rgba(${spec.glassRgb}, 0.20)` : 'rgba(20, 20, 40, 0.16)',
        '--lamp-glow': `rgba(${spec.glowRgb}, ${dark ? 0.7 : 0.45})`,
        '--lamp-icon-bg': spec.iconBg, '--lamp-icon-fg': spec.iconFg,
        '--elev-raised': dark
            ? `0 0 0 1px rgba(${spec.glowRgb}, 0.32), 0 18px 50px -14px rgba(${spec.glowRgb}, 0.40)`
            : `0 16px 36px -16px rgba(${spec.glowRgb}, 0.55)`,
    };
};

// Вдохновлено оформлением сервисов Яндекса: волны "Моей волны", фиолетовый Алисы,
// жёлтый Музыки, лавандовый Дома с Алисой, ночные Карты, градиент Плюса, бирюза Браузера.
export const PALETTES: Palette[] = [
    {
        id: 'volna',
        base: 'dark',
        swatch: ['#09090D', '#FF3DA5', '#3D7BFF', '#F7F3FF'],
        tokens: build({
            base: 'dark', bg: '#09090D', surface: '#16161E', fg: '#F2F1F7', fg2: '#C2C0D0', muted: '#8E8BA0',
            border: '#26252F', glassRgb: '255, 255, 255',
            accent: '#FF5CB4', accentOn: '#2A0418', accentHover: '#FF7DC4',
            lit: '#F7F3FF', litFg: '#120E1C', glowRgb: '255, 120, 200',
            iconBg: '#15101F', iconFg: '#FF9AD2', toggle: '#FF5CB4', star: '#FFD84D',
            auroraA: 'rgba(255, 61, 165, 0.30)', auroraB: 'rgba(61, 123, 255, 0.30)', auroraC: 'rgba(120, 255, 210, 0.10)',
        }),
    },
    {
        id: 'alisa',
        base: 'dark',
        swatch: ['#0D0A22', '#8B5CFF', '#3E8BFF', '#EEE8FF'],
        tokens: build({
            base: 'dark', bg: '#0D0A22', surface: '#1A1636', fg: '#EEEBFF', fg2: '#BEB8E0', muted: '#8C86B0',
            border: '#2A2550', glassRgb: '200, 190, 255',
            accent: '#9C7BFF', accentOn: '#140A33', accentHover: '#B39BFF',
            lit: '#EEE8FF', litFg: '#150F33', glowRgb: '170, 140, 255',
            iconBg: '#1A1240', iconFg: '#C9B6FF', toggle: '#8B5CFF', star: '#FFD84D',
            auroraA: 'rgba(139, 92, 255, 0.34)', auroraB: 'rgba(62, 139, 255, 0.26)', auroraC: 'rgba(255, 110, 220, 0.10)',
        }),
    },
    {
        id: 'muzyka',
        base: 'dark',
        swatch: ['#111111', '#FFDB4D', '#5B5B5B', '#FFF7D1'],
        tokens: build({
            base: 'dark', bg: '#111111', surface: '#1D1D1D', fg: '#F5F5F5', fg2: '#C4C4C4', muted: '#8F8F8F',
            border: '#2A2A2A', glassRgb: '255, 255, 255',
            accent: '#FFDB4D', accentOn: '#1A1600', accentHover: '#FFE57A',
            lit: '#FFF7D1', litFg: '#171300', glowRgb: '255, 222, 90',
            iconBg: '#1A1700', iconFg: '#FFE16A', toggle: '#FFDB4D', star: '#FFDB4D',
            auroraA: 'rgba(255, 219, 77, 0.16)', auroraB: 'rgba(255, 255, 255, 0.05)', auroraC: 'rgba(255, 219, 77, 0.06)',
        }),
    },
    {
        id: 'dom',
        base: 'light',
        swatch: ['#F3F1FB', '#6E4BFF', '#B7A6FF', '#22184A'],
        tokens: build({
            base: 'light', bg: '#F3F1FB', surface: '#E8E4F7', fg: '#1C1640', fg2: '#3D3566', muted: '#6F6894',
            border: '#DCD6F0', glassRgb: '255, 255, 255',
            accent: '#6E4BFF', accentOn: '#FFFFFF', accentHover: '#5A38EB',
            lit: '#22184A', litFg: '#F3EFFF', glowRgb: '110, 75, 255',
            iconBg: '#30235F', iconFg: '#D4C7FF', toggle: '#6E4BFF', star: '#E0A800',
            auroraA: 'rgba(150, 120, 255, 0.28)', auroraB: 'rgba(110, 190, 255, 0.24)', auroraC: 'rgba(255, 170, 230, 0.16)',
        }),
    },
    {
        id: 'gorod',
        base: 'dark',
        swatch: ['#121A2B', '#4D8DFF', '#2EC28B', '#E8F0FF'],
        tokens: build({
            base: 'dark', bg: '#121A2B', surface: '#1C2740', fg: '#E8EEFA', fg2: '#B4C0D8', muted: '#8391AD',
            border: '#26324D', glassRgb: '190, 210, 255',
            accent: '#4D8DFF', accentOn: '#FFFFFF', accentHover: '#6FA3FF',
            lit: '#E8F0FF', litFg: '#0E1626', glowRgb: '120, 170, 255',
            iconBg: '#0F1D38', iconFg: '#9EC2FF', toggle: '#2EC28B', star: '#FFD84D',
            auroraA: 'rgba(77, 141, 255, 0.24)', auroraB: 'rgba(46, 194, 139, 0.14)', auroraC: 'rgba(255, 255, 255, 0.04)',
        }),
    },
    {
        id: 'plus',
        base: 'light',
        swatch: ['#FBF2F8', '#EB469F', '#8341EF', '#2A1238'],
        tokens: build({
            base: 'light', bg: '#FBF2F8', surface: '#F3E3EF', fg: '#2A1238', fg2: '#4D2E5C', muted: '#86688F',
            border: '#EDD8E8', glassRgb: '255, 255, 255',
            accent: '#C8378C', accentOn: '#FFFFFF', accentHover: '#AE2C78',
            lit: '#2A1238', litFg: '#FFEAF6', glowRgb: '235, 70, 159',
            iconBg: '#3F1A52', iconFg: '#FFB3DE', toggle: '#C8378C', star: '#E0A800',
            auroraA: 'rgba(235, 70, 159, 0.26)', auroraB: 'rgba(131, 65, 239, 0.24)', auroraC: 'rgba(255, 200, 230, 0.30)',
        }),
    },
    {
        id: 'biryuza',
        base: 'light',
        swatch: ['#EEF8F7', '#00A3A3', '#5CC8FF', '#0D2B2E'],
        tokens: build({
            base: 'light', bg: '#EEF8F7', surface: '#DDEFEE', fg: '#0D2B2E', fg2: '#2C4B4E', muted: '#5F7D80',
            border: '#D0E6E4', glassRgb: '255, 255, 255',
            accent: '#008F8F', accentOn: '#FFFFFF', accentHover: '#007A7A',
            lit: '#0D2B2E', litFg: '#E6FBFA', glowRgb: '0, 170, 170',
            iconBg: '#123E42', iconFg: '#9FF0EC', toggle: '#008F8F', star: '#E0A800',
            auroraA: 'rgba(0, 190, 190, 0.24)', auroraB: 'rgba(92, 200, 255, 0.24)', auroraC: 'rgba(255, 255, 255, 0.45)',
        }),
    },
];

export const ALL_TOKEN_NAMES = Array.from(new Set(PALETTES.flatMap(p => Object.keys(p.tokens))));

export const paletteById = (id: string | undefined): Palette | undefined => PALETTES.find(p => p.id === id);

export type ThemeMode = 'cycle' | 'fixed';

export interface ThemeSettings {
    mode: ThemeMode;
    /** Закреплённая тема для режима "Одна тема". */
    fixed: PaletteId;
    /** Интервал смены в часах для режима автосмены. */
    intervalHours: number;
    /** Темы, участвующие в автосмене (в порядке PALETTES). */
    cycle: PaletteId[];
}

export const INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 8, 12];

export const DEFAULT_SETTINGS: ThemeSettings = {
    mode: 'cycle',
    fixed: 'alisa',
    intervalHours: 3,
    cycle: PALETTES.map(p => p.id),
};

/** Номер текущего "слота" смены: считается от полуночи местного времени, смена всегда в ровный час. */
const slotIndex = (intervalHours: number, now: Date) => {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayIndex = Math.round((midnight.getTime() - midnight.getTimezoneOffset() * 60_000) / 86_400_000);
    const slotsPerDay = Math.ceil(24 / intervalHours);
    return dayIndex * slotsPerDay + Math.floor(now.getHours() / intervalHours);
};

/** Какая тема активна в данный момент при заданных настройках. */
export const resolvePalette = (settings: ThemeSettings, now: Date = new Date()): Palette => {
    if (settings.mode === 'fixed') {
        return paletteById(settings.fixed) ?? PALETTES[0];
    }
    const members = PALETTES.filter(p => settings.cycle.includes(p.id));
    const list = members.length > 0 ? members : PALETTES;
    return list[slotIndex(settings.intervalHours, now) % list.length];
};

/** Когда сменится тема, или null, если тема закреплена. */
export const nextChange = (settings: ThemeSettings, now: Date = new Date()): Date | null => {
    if (settings.mode === 'fixed') return null;
    const step = settings.intervalHours;
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    next.setHours((Math.floor(now.getHours() / step) + 1) * step);
    return next;
};
