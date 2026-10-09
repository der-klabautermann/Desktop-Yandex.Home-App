import React, { useEffect, useRef, useState } from 'react';
import {
    Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Loader2, MapPin, Moon, Sun, X,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useWeather, weatherKey, type Place } from '../../contexts/WeatherContext';

const ICONS: Record<string, [React.ElementType, React.ElementType]> = {
    clear: [Sun, Moon], partly: [CloudSun, CloudMoon], cloudy: [Cloud, Cloud], fog: [CloudFog, CloudFog],
    drizzle: [CloudDrizzle, CloudDrizzle], rain: [CloudRain, CloudRain], snow: [CloudSnow, CloudSnow], storm: [CloudLightning, CloudLightning],
};

/** Погода в выбранном месте; без места: кнопка выбора с поиском города. */
export const WeatherWidget: React.FC = () => {
    const { t, lang } = useI18n();
    const { place, weather, setPlace, searchPlaces } = useWeather();
    const [picking, setPicking] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Place[]>([]);
    const [busy, setBusy] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!picking) return;
        const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setPicking(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [picking]);

    useEffect(() => {
        if (!picking || query.trim().length < 2) { setResults([]); return; }
        const timer = window.setTimeout(async () => {
            setBusy(true);
            try { setResults(await searchPlaces(query, lang)); } catch { setResults([]); } finally { setBusy(false); }
        }, 300);
        return () => window.clearTimeout(timer);
    }, [query, picking, lang, searchPlaces]);

    const key = weather ? weatherKey(weather.code) : null;
    const Icon = key ? ICONS[key][weather!.isDay ? 0 : 1] : MapPin;

    return (
        <div className="weather" ref={box}>
            <button className="weather-main" onClick={() => setPicking(open => !open)} title={t('weather.choosePlace')}>
                <span className={`weather-icon ${key ? `is-${key}` : ''}`}><Icon className="w-7 h-7" /></span>
                {place && weather ? (
                    <span className="weather-text">
                        <b>{Math.round(weather.temperature)}°C</b>
                        <small>{place.name}, {t(`weather.${key}`)}</small>
                    </span>
                ) : (
                    <span className="weather-text">
                        <b className="weather-placeholder">{place ? '…' : t('weather.setPlace')}</b>
                        {place && <small>{place.name}</small>}
                    </span>
                )}
            </button>

            {picking && (
                <div className="weather-picker" role="dialog" aria-label={t('weather.choosePlace')}>
                    <div className="weather-search">
                        <MapPin className="w-4 h-4" />
                        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t('weather.searchPlace')} />
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    </div>
                    {results.map(result => (
                        <button
                            key={`${result.latitude},${result.longitude}`}
                            className="weather-result"
                            onClick={() => { setPlace(result); setPicking(false); setQuery(''); }}
                        >
                            <b>{result.name}</b>
                            {result.region && <small>{result.region}</small>}
                        </button>
                    ))}
                    {place && (
                        <button className="weather-result is-remove" onClick={() => { setPlace(null); setPicking(false); }}>
                            <X className="w-3.5 h-3.5" /> {t('weather.removePlace')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
