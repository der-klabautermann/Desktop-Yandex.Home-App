import React from 'react';
import { ArrowLeft, CloudOff, Expand } from 'lucide-react';
import type { YandexDevice } from '../types/index';
import { useDashboardContext } from '../contexts/DashboardContext';
import { UseDashboardStateReturn } from '../hooks/useDashboardState';
import { useI18n } from '../i18n/I18nContext';
import { Pinned } from './Pinned';
import { CameraStreamModal } from './modals/CameraStreamModal';

interface DashboardCamerasViewProps {
    state: UseDashboardStateReturn;
    cameras: YandexDevice[];
}

/** Все камеры дома с живым изображением; крупно по кнопке в углу. */
export const DashboardCamerasView: React.FC<DashboardCamerasViewProps> = ({ state, cameras }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    // Камера открыта крупно: в сетке её поток останавливаем, чтобы не держать два подключения
    const expandedId = state.modal.selectedCameraDevice?.id;

    return (
        <>
            <Pinned>
                <div className="zone-overview">
                    <button className="zone-edit" onClick={ctx.onSelectHome}>
                        <ArrowLeft className="w-4 h-4" /> {t('devicePage.back')}
                    </button>
                </div>
            </Pinned>

            {cameras.length === 0 && <div className="empty-state"><p>{t('camera.none')}</p></div>}

            <div className="camera-grid">
                {cameras.map(camera => camera.unreachable || camera.id === expandedId ? (
                    <div key={camera.id} className="camera-tile camera-tile-idle">
                        <div className="camera-tile-idle-body">
                            {camera.unreachable ? <CloudOff className="w-6 h-6" /> : <Expand className="w-6 h-6" />}
                            <span>{camera.name}</span>
                        </div>
                    </div>
                ) : (
                    <CameraStreamModal
                        key={camera.id}
                        variant="tile"
                        device={camera}
                        isOpen
                        onClose={() => {}}
                        onGetStream={ctx.onGetCameraStream}
                        onSetPrivacy={ctx.onSetCameraPrivacy}
                        onExpand={() => state.openCameraStream(camera)}
                    />
                ))}
            </div>
        </>
    );
};
