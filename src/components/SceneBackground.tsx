import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useWeather } from '../contexts/WeatherContext';
import { seasonFor, type Season } from '../themes/palettes';
import { SCENE_VIDEOS, VIDEO_RATE, VILLAGE_CLOCKS, type ClockSpot } from './sceneEffects';

/**
 * Фоновая сцена во всё окно: фото (public/scenes/<сцена>-<сезон>-day|night.webp) с медленным
 * проездом камеры, мерцающим тёплым светом и частицами по сезону (снег, лепестки, светлячки, листья).
 */
export const SceneBackground: React.FC = () => {
    const { settings } = useTheme();
    const { isNight, place } = useWeather();
    const scene = settings.scene;
    const season: Season = settings.season === 'auto' ? seasonFor(new Date(), (place?.latitude ?? 1) < 0) : settings.season;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const moving = settings.motion && !reduced;

    // Атрибуты на <html>: по ним CSS делает панели стеклянными
    useEffect(() => {
        const root = document.documentElement;
        if (scene === 'none') root.removeAttribute('data-scene');
        else root.setAttribute('data-scene', scene);
        root.toggleAttribute('data-scene-motion', scene !== 'none' && moving);
        return () => { root.removeAttribute('data-scene'); root.removeAttribute('data-scene-motion'); };
    }, [scene, moving]);

    if (scene === 'none') return null;
    const url = `./scenes/${scene}-${season}-${isNight ? 'night' : 'day'}.webp`;

    const daylight = isNight ? 'night' : 'day';
    const key = `${scene}-${season}-${daylight}`;
    // Видео только при включённом движении; иначе неподвижное фото
    const video = moving && SCENE_VIDEOS.has(key);
    return (
        <div className={`scene-bg is-${scene} ${isNight ? 'is-night' : 'is-day'}`} aria-hidden>
            {/* Сцена всегда 16:9 и накрывает окно: так проценты картинки совпадают с наложениями */}
            <div key={url} className="scene-stage">
                {video ? (
                    <video
                        className="scene-photo scene-video" src={`./scenes/${key}.mp4`} poster={url} autoPlay muted loop playsInline
                        // Langsamer abspielen: ruhiger Kamin statt hektischer Flammen
                        onLoadedMetadata={e => { e.currentTarget.playbackRate = VIDEO_RATE; }}
                    />
                ) : (
                    <div className="scene-photo" style={{ backgroundImage: `url(${url})` }} />
                )}
                {scene === 'village' && <TowerClock spot={VILLAGE_CLOCKS[season][daylight]} />}
            </div>
            {isNight && !video && <div className="scene-glow" />}
            {moving && scene === 'village' && <Particles season={season} night={isNight} />}
            <div className="scene-veil" />
        </div>
    );
};

interface Particle { x: number; y: number; r: number; vx: number; vy: number; phase: number; spin: number; angle: number }

const COUNT: Record<Season, number> = { winter: 70, spring: 26, summer: 30, autumn: 22 };

/** Частицы на canvas, около 30 кадров в секунду; на скрытой вкладке не рисуют. */
const Particles: React.FC<{ season: Season; night: boolean }> = ({ season, night }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        let width = 0;
        let height = 0;
        const resize = () => {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const random = (min: number, max: number) => min + Math.random() * (max - min);
        const spawn = (initial: boolean): Particle => {
            const fireflies = season === 'summer';
            return {
                x: random(0, width),
                y: initial || fireflies ? random(0, height) : random(-40, -10),
                r: season === 'winter' ? random(1, 3.2) : fireflies ? random(1.2, 2.6) : random(4, 8),
                vx: fireflies ? random(-0.25, 0.25) : random(-0.3, 0.3),
                vy: season === 'winter' ? random(0.4, 1.2) : fireflies ? random(-0.2, 0.2) : random(0.35, 0.9),
                phase: random(0, Math.PI * 2),
                spin: random(-0.02, 0.02),
                angle: random(0, Math.PI * 2),
            };
        };
        const particles = Array.from({ length: COUNT[season] }, () => spawn(true));

        const draw = (p: Particle, time: number) => {
            if (season === 'winter') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            } else if (season === 'summer') {
                // Ночью светлячки, днём едва заметная пыльца
                const pulse = 0.35 + 0.65 * Math.abs(Math.sin(time / 900 + p.phase));
                const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
                const color = night ? '255, 214, 110' : '255, 250, 230';
                glow.addColorStop(0, `rgba(${color}, ${(night ? 0.9 : 0.35) * pulse})`);
                glow.addColorStop(1, `rgba(${color}, 0)`);
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
            } else {
                // Лепестки весной, листья осенью: вытянутый эллипс, вращается при падении
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle = season === 'spring'
                    ? 'rgba(255, 196, 214, 0.85)'
                    : ['rgba(214, 112, 38, 0.9)', 'rgba(232, 160, 52, 0.9)', 'rgba(170, 64, 34, 0.9)'][Math.floor(p.phase) % 3];
                ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        };

        let frame = 0;
        let last = 0;
        const tick = (time: number) => {
            frame = requestAnimationFrame(tick);
            if (document.hidden || time - last < 33) return;
            last = time;
            ctx.clearRect(0, 0, width, height);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.phase += 0.02;
                p.angle += p.spin;
                p.x += p.vx + Math.sin(p.phase) * (season === 'summer' ? 0.35 : 0.5);
                p.y += p.vy;
                const out = p.y > height + 20 || p.y < -60 || p.x < -40 || p.x > width + 40;
                if (out) particles[i] = spawn(season === 'summer');
                draw(particles[i], time);
            }
        };
        frame = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
    }, [season, night]);

    return <canvas ref={canvasRef} className="scene-particles" />;
};

/** Часы на башне с настоящим временем поверх нарисованного циферблата. */
const TowerClock: React.FC<{ spot: ClockSpot }> = ({ spot }) => {
    const [now, setNow] = React.useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 20_000);
        return () => window.clearInterval(timer);
    }, []);
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    // Высота в процентах сцены: у сцены 16:9, поэтому диаметр по высоте в 16/9 раза больше
    const style: React.CSSProperties = {
        left: `${spot.x - spot.size / 2}%`,
        top: `${spot.y - (spot.size * 16 / 9) / 2}%`,
        width: `${spot.size}%`,
    };
    return (
        <svg className="scene-clock" viewBox="0 0 100 100" style={style}>
            <circle cx="50" cy="50" r="47" fill={spot.face} />
            {Array.from({ length: 12 }, (_, i) => (
                <line key={i} x1="50" y1="7" x2="50" y2={i % 3 === 0 ? 17 : 13} stroke={spot.hands} strokeWidth={i % 3 === 0 ? 5 : 3}
                    transform={`rotate(${i * 30} 50 50)`} opacity="0.85" />
            ))}
            <line x1="50" y1="50" x2="50" y2="24" stroke={spot.hands} strokeWidth="7" strokeLinecap="round" transform={`rotate(${hours * 30} 50 50)`} />
            <line x1="50" y1="50" x2="50" y2="12" stroke={spot.hands} strokeWidth="4.5" strokeLinecap="round" transform={`rotate(${minutes * 6} 50 50)`} />
            <circle cx="50" cy="50" r="5" fill={spot.hands} />
        </svg>
    );
};
