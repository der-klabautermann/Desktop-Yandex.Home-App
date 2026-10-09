import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useWeather } from '../contexts/WeatherContext';
import { useI18n } from '../i18n/I18nContext';

/** День или ночь для картинок и пейзажа; переключение вручную, «Автоматически» в настройках. */
export const DaylightButton: React.FC = () => {
    const { updateSettings } = useTheme();
    const { isNight } = useWeather();
    const { t } = useI18n();
    return (
        <button
            className="header-btn"
            onClick={() => updateSettings({ daylight: isNight ? 'day' : 'night' })}
            title={isNight ? t('daylight.day') : t('daylight.night')}
            aria-label={isNight ? t('daylight.day') : t('daylight.night')}
        >
            {isNight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
    );
};
