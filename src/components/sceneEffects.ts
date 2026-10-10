// Где на картинках сцен стоят часы на башне и течёт река (в процентах картинки 16:9).
// Значения измерены по каждой картинке; день и ночь немного отличаются.
import type { Season } from '../themes/palettes';

export interface ClockSpot {
    x: number; y: number;
    /** Диаметр циферблата в процентах ширины картинки. */
    size: number;
    face: string;
    hands: string;
}

/** Многоугольник воды: пары [x, y] в процентах картинки. */
export type Polygon = Array<[number, number]>;

const DARK_HANDS = '#2A1E16';

export const VILLAGE_CLOCKS: Record<Season, Record<'day' | 'night', ClockSpot>> = {
    // Все времена года сделаны из осенней картинки, поэтому часы стоят почти в одном месте
    spring: {
        night: { x: 69.83, y: 34.94, size: 1.1, face: '#F8E17A', hands: DARK_HANDS },
        day: { x: 69.83, y: 34.94, size: 1.1, face: '#F2D9BB', hands: DARK_HANDS },
    },
    summer: {
        night: { x: 70.11, y: 34.76, size: 1.1, face: '#F7D66F', hands: DARK_HANDS },
        day: { x: 69.95, y: 34.94, size: 1.1, face: '#F0D6C1', hands: DARK_HANDS },
    },
    autumn: {
        night: { x: 69.83, y: 34.94, size: 1.1, face: '#FBEA9E', hands: DARK_HANDS },
        day: { x: 69.85, y: 34.94, size: 1.1, face: '#F1D8BE', hands: DARK_HANDS },
    },
    winter: {
        night: { x: 69.83, y: 34.94, size: 1.1, face: '#F9E26D', hands: DARK_HANDS },
        day: { x: 69.83, y: 34.94, size: 1.1, face: '#E6CBBE', hands: DARK_HANDS },
    },
};

const AUTUMN_RIVER: Polygon[] = [
        [[52, 55], [58, 55], [58, 61], [52.5, 61]],
        [[60, 69], [64, 67], [72, 68], [80, 71], [90, 76], [100, 82], [100, 100], [81, 100], [72, 89], [64, 79], [60, 73]],
];

/** Река везде одна и та же: все времена года сделаны из осенней картинки. */
export const VILLAGE_RIVER: Record<Season, Polygon[]> = {
    spring: AUTUMN_RIVER, summer: AUTUMN_RIVER, autumn: AUTUMN_RIVER, winter: AUTUMN_RIVER,
};

/** Сцены, для которых есть видео (public/scenes/<ключ>.mp4): огонь, свечи и река живые. */
export const SCENE_VIDEOS = new Set<string>([]);

/** Скорость видео сцен: медленнее выглядит спокойнее. */
export const VIDEO_RATE = 0.6;
