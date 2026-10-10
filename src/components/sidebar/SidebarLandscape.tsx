import React, { useContext, useEffect, useState } from 'react';
import { WeatherContext } from '../../contexts/WeatherContext';

/** Пейзажи внизу боковой панели: public/sidebar-art/<ключ>-day.webp и -night.webp. */
export const LANDSCAPES = ['mountains-lake', 'alpine-valley', 'misty-hills', 'snow-peaks'];
const SLIDE_MS = 20_000;

/**
 * Слайд-шоу пейзажей: картинки плавно сменяют друг друга, днём и ночью свои версии
 * одного и того же места. Сверху пейзаж растворяется в фоне панели.
 */
export const SidebarLandscape: React.FC = () => {
    const night = useContext(WeatherContext)?.isNight ?? true;
    const [index, setIndex] = useState(() => Math.floor(Math.random() * LANDSCAPES.length));

    useEffect(() => {
        const timer = window.setInterval(() => setIndex(i => (i + 1) % LANDSCAPES.length), SLIDE_MS);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="sidebar-landscape-art" aria-hidden>
            {LANDSCAPES.map((key, i) => (
                <div
                    key={key}
                    className={`landscape-slide ${i === index ? 'is-active' : ''}`}
                    style={{ backgroundImage: `url(./sidebar-art/${key}-${night ? 'night' : 'day'}.webp)` }}
                />
            ))}
        </div>
    );
};
