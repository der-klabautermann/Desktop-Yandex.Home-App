import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTheme } from './ThemeContext';

// Погода для виджета и день/ночь для картинок. Данные Open-Meteo: бесплатно, без ключа и без входа.

export interface Place { name: string; region?: string; latitude: number; longitude: number }

export interface Weather {
    temperature: number;
    /** Код погоды WMO. */
    code: number;
    isDay: boolean;
}

interface WeatherContextValue {
    place: Place | null;
    weather: Weather | null;
    setPlace: (place: Place | null) => void;
    searchPlaces: (query: string, lang: string) => Promise<Place[]>;
    /** Итог для картинок: ночь (вручную или по солнцу в выбранном месте). */
    isNight: boolean;
}

const PLACE_KEY = 'app_weather_place';
const REFRESH_MS = 15 * 60_000;

const loadPlace = (): Place | null => {
    try {
        const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null');
        return saved && typeof saved.latitude === 'number' && typeof saved.longitude === 'number' ? saved : null;
    } catch {
        return null;
    }
};

export const WeatherContext = createContext<WeatherContextValue | undefined>(undefined);

/** Без места: ночь с 19 до 7 часов. */
const nightByClock = (now = new Date()) => now.getHours() >= 19 || now.getHours() < 7;

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings } = useTheme();
    const [place, setPlaceState] = useState<Place | null>(loadPlace);
    const [weather, setWeather] = useState<Weather | null>(null);
    const [clockNight, setClockNight] = useState(nightByClock);

    const setPlace = useCallback((next: Place | null) => {
        setPlaceState(next);
        setWeather(null);
        try {
            if (next) localStorage.setItem(PLACE_KEY, JSON.stringify(next));
            else localStorage.removeItem(PLACE_KEY);
        } catch { /* место просто не сохранится */ }
    }, []);

    useEffect(() => {
        if (!place) return;
        let cancelled = false;
        const load = async () => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}`
                    + '&current=temperature_2m,weather_code,is_day&timezone=auto';
                const data = await (await fetch(url)).json();
                if (cancelled || !data?.current) return;
                setWeather({ temperature: data.current.temperature_2m, code: data.current.weather_code, isDay: data.current.is_day === 1 });
            } catch {
                // Нет сети: виджет просто показывает последнее значение
            }
        };
        void load();
        const timer = window.setInterval(load, REFRESH_MS);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [place]);

    useEffect(() => {
        const timer = window.setInterval(() => setClockNight(nightByClock()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const searchPlaces = useCallback(async (query: string, lang: string): Promise<Place[]> => {
        if (query.trim().length < 2) return [];
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=${lang}&format=json`;
        const data = await (await fetch(url)).json();
        return (data?.results ?? []).map((r: any) => ({
            name: r.name, region: [r.admin1, r.country].filter(Boolean).join(', '), latitude: r.latitude, longitude: r.longitude,
        }));
    }, []);

    const isNight = settings.daylight === 'night'
        || (settings.daylight === 'auto' && (weather ? !weather.isDay : clockNight));

    useEffect(() => {
        document.documentElement.setAttribute('data-daylight', isNight ? 'night' : 'day');
    }, [isNight]);

    const value = useMemo(() => ({ place, weather, setPlace, searchPlaces, isNight }), [place, weather, setPlace, searchPlaces, isNight]);
    return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
};

export const useWeather = () => {
    const context = useContext(WeatherContext);
    if (!context) throw new Error('useWeather must be used within a WeatherProvider');
    return context;
};

/** Название погоды по коду WMO (ключ словаря weather.*). */
export const weatherKey = (code: number): string => {
    if (code === 0) return 'clear';
    if (code <= 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloudy';
};
