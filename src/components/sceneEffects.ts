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
const LIGHT_HANDS = '#F1E4C8';

export const VILLAGE_CLOCKS: Record<Season, Record<'day' | 'night', ClockSpot>> = {
    spring: {
        night: { x: 68.43, y: 22.95, size: 0.67, face: '#4C3430', hands: LIGHT_HANDS },
        day: { x: 68.63, y: 22.56, size: 0.67, face: '#524B4B', hands: LIGHT_HANDS },
    },
    summer: {
        night: { x: 67.48, y: 31.6, size: 1.0, face: '#F9D48F', hands: DARK_HANDS },
        day: { x: 67.5, y: 31.6, size: 1.0, face: '#E4DBD7', hands: DARK_HANDS },
    },
    autumn: {
        night: { x: 69.83, y: 34.94, size: 1.1, face: '#FBEA9E', hands: DARK_HANDS },
        day: { x: 69.85, y: 34.94, size: 1.1, face: '#F3D9C0', hands: DARK_HANDS },
    },
    winter: {
        night: { x: 66.73, y: 30.13, size: 0.83, face: '#362220', hands: LIGHT_HANDS },
        day: { x: 67.03, y: 29.78, size: 0.77, face: '#69646B', hands: LIGHT_HANDS },
    },
};

export const VILLAGE_RIVER: Record<Season, Polygon[]> = {
    spring: [
        [[50, 60], [57, 60], [57.5, 66], [50.5, 66]],
        [[64, 71], [72, 70], [78, 72], [86, 76], [94, 82], [100, 86], [100, 100], [90, 100], [82, 92], [74, 84], [66, 77]],
    ],
    summer: [
        [[47.5, 55], [51, 55], [55, 62], [57, 68], [52, 68], [48, 62]],
        [[68, 74], [76, 71], [83, 74], [86, 82], [88, 90], [83, 92], [76, 84], [70, 79]],
    ],
    autumn: [
        [[52, 55], [58, 55], [58, 61], [52.5, 61]],
        [[60, 69], [64, 67], [72, 68], [80, 71], [90, 76], [100, 82], [100, 100], [81, 100], [72, 89], [64, 79], [60, 73]],
    ],
    winter: [
        [[52, 60], [60, 58], [62, 62], [53, 64]],
        [[65, 73], [82, 72], [100, 78], [100, 100], [88, 100], [78, 88], [70, 80]],
    ],
};

/** Сцены, для которых есть видео (public/scenes/<ключ>.mp4): огонь, свечи и река живые. */
export const SCENE_VIDEOS = new Set<string>(['cabin-winter-night']);
