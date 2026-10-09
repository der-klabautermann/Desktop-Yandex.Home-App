import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronRight, ExternalLink, Loader2, Plus, Radar, RefreshCw, X } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { addOptions as loadAddOptions, openAddDevice, pairingHubs, startPairing, stopPairing } from '../../services/hub';
import { getIconForDevice } from '../../constants';
import { cleanErrorMessage } from '../../utils/errors';
import { ProviderMark } from './ProviderMark';
import type { ProviderId } from '../../types/electron-api';

type AddMethod = 'pairing' | 'external' | 'none';
type Step =
    | { kind: 'choose' }
    | { kind: 'pairing'; providerId: ProviderId }
    | { kind: 'external'; providerId: ProviderId };

interface AddDeviceDialogProps {
    /** Сразу открыть шаг этого сервиса. */
    providerId?: ProviderId;
    onClose: () => void;
    /** Подключить ещё не подключённый сервис. */
    onConnectNew: () => void;
    onOpenDevice: (deviceId: string) => void;
}

/** Сколько длится режим добавления у хаба (как в приложении Aqara). */
const PAIRING_SECONDS = 180;
/** Как часто во время добавления спрашиваем сервис о новых устройствах. */
const POLL_MS = 5000;

/** Добавление устройства: через хаб сервиса (Aqara) или на странице самого сервиса (Яндекс, Home Assistant). */
export const AddDeviceDialog: React.FC<AddDeviceDialogProps> = ({ providerId, onClose, onConnectNew, onOpenDevice }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    const [methods, setMethods] = useState<Record<string, AddMethod>>({});
    const [step, setStep] = useState<Step>({ kind: 'choose' });
    const [hubs, setHubs] = useState<Array<{ id: string; name: string; online: boolean }> | null>(null);
    const [hubId, setHubId] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    // Устройства, которые были до начала добавления: всё остальное считаем новым
    const [known, setKnown] = useState<Set<string> | null>(null);
    const activeHub = useRef<string | null>(null);

    const connected = ctx.accounts.filter(a => a.status === 'connected');

    useEffect(() => {
        loadAddOptions().then(result => {
            setMethods(result);
            if (providerId && result[providerId] && result[providerId] !== 'none') {
                setStep({ kind: result[providerId] as 'pairing' | 'external', providerId });
            }
        }).catch(() => {});
    }, [providerId]);

    // Список хабов для сопряжения
    useEffect(() => {
        if (step.kind !== 'pairing') return;
        setHubs(null);
        pairingHubs(step.providerId)
            .then(list => { setHubs(list); setHubId(list.find(h => h.online)?.id ?? null); })
            .catch(err => { setHubs([]); setError(cleanErrorMessage(err, t)); });
    }, [step, t]);

    // Обратный отсчёт и опрос сервиса, пока хаб ищет устройства
    useEffect(() => {
        if (secondsLeft === null) return;
        if (secondsLeft <= 0) { void finishPairing(); return; }
        const timer = setTimeout(() => setSecondsLeft(s => (s === null ? null : s - 1)), 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [secondsLeft]);

    useEffect(() => {
        if (secondsLeft === null) return;
        const poll = setInterval(() => ctx.onRefresh(true), POLL_MS);
        return () => clearInterval(poll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [secondsLeft === null]);

    // Закрыли окно во время сопряжения: выключаем режим у хаба
    useEffect(() => () => { if (activeHub.current) void stopPairing(activeHub.current).catch(() => {}); }, []);

    const providerOfStep = step.kind === 'choose' ? null : step.providerId;
    const found = useMemo(() => {
        if (!known || !providerOfStep) return [];
        return ctx.data.devices.filter(d => !known.has(d.id) && (d.provider_id ?? 'yandex') === providerOfStep);
    }, [ctx.data.devices, known, providerOfStep]);

    const snapshot = () => setKnown(new Set(ctx.data.devices.map(d => d.id)));

    const beginPairing = async () => {
        if (!hubId) return;
        setBusy(true);
        setError(undefined);
        try {
            snapshot();
            await startPairing(hubId);
            activeHub.current = hubId;
            setSecondsLeft(PAIRING_SECONDS);
        } catch (err) {
            setError(cleanErrorMessage(err, t));
        } finally {
            setBusy(false);
        }
    };

    async function finishPairing() {
        const hub = activeHub.current;
        activeHub.current = null;
        setSecondsLeft(null);
        if (hub) await stopPairing(hub).catch(() => {});
        ctx.onRefresh(true);
    }

    const openService = async (id: ProviderId) => {
        setBusy(true);
        setError(undefined);
        try {
            snapshot();
            await openAddDevice(id);
        } catch (err) {
            setError(cleanErrorMessage(err, t));
        } finally {
            setBusy(false);
        }
    };

    const search = async () => {
        setBusy(true);
        if (!known) snapshot();
        ctx.onRefresh(true);
        // Обновление идёт в фоне, кнопку держим занятой, пока оно обычно завершается
        setTimeout(() => setBusy(false), 1500);
    };

    const back = () => {
        if (secondsLeft !== null) void finishPairing();
        setKnown(null);
        setError(undefined);
        setStep({ kind: 'choose' });
    };

    const name = (id: ProviderId) => t(`services.names.${id}`);
    const time = secondsLeft === null ? '' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

    const foundList = found.length > 0 && (
        <div className="add-found">
            <h4>{t('addDevice.found')}</h4>
            {found.map(device => (
                <button key={device.id} className="add-found-item" onClick={() => onOpenDevice(device.id)}>
                    <span className="group-pick-icon">{getIconForDevice(device.type)}</span>
                    <span className="group-pick-name">{device.name}</span>
                    <ChevronRight className="w-4 h-4" />
                </button>
            ))}
        </div>
    );

    return createPortal(
        <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="zone-dialog add-device" role="dialog" aria-label={t('addDevice.title')}>
                <header>
                    {step.kind !== 'choose' && !providerId && (
                        <button className="header-btn" onClick={back} title={t('devicePage.back')}><ArrowLeft className="w-4 h-4" /></button>
                    )}
                    <h3>{step.kind === 'choose' ? t('addDevice.title') : name(step.providerId)}</h3>
                    <button className="header-btn" onClick={onClose} title={t('common.close')}><X className="w-4 h-4" /></button>
                </header>

                {step.kind === 'choose' && (
                    <div className="add-choose">
                        {connected.map(account => {
                            const method = methods[account.providerId] ?? 'none';
                            return (
                                <button
                                    key={account.providerId}
                                    className="add-choice"
                                    disabled={method === 'none'}
                                    onClick={() => setStep({ kind: method as 'pairing' | 'external', providerId: account.providerId })}
                                >
                                    <ProviderMark id={account.providerId} />
                                    <span className="add-choice-text">
                                        <strong>{name(account.providerId)}</strong>
                                        <small>{t(`addDevice.method.${method}`)}</small>
                                    </span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            );
                        })}
                        <button className="add-choice is-new" onClick={onConnectNew}>
                            <span className="add-choice-plus"><Plus className="w-4 h-4" /></span>
                            <span className="add-choice-text"><strong>{t('addDevice.newService')}</strong></span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {step.kind === 'pairing' && (
                    <>
                        {secondsLeft === null ? (
                            <>
                                {hubs === null && <p className="zone-dialog-hint"><Loader2 className="w-4 h-4 animate-spin" /></p>}
                                {hubs?.length === 0 && !error && <p className="zone-dialog-hint">{t('addDevice.noHub')}</p>}
                                {hubs && hubs.length > 0 && (
                                    <>
                                        <label>{t('addDevice.hub')}</label>
                                        <div className="dd-chips">
                                            {hubs.map(hub => (
                                                <button
                                                    key={hub.id}
                                                    className={`dd-chip ${hubId === hub.id ? 'is-active' : ''}`}
                                                    disabled={!hub.online}
                                                    title={hub.online ? undefined : t('services.status.offline')}
                                                    onClick={() => setHubId(hub.id)}
                                                >{hub.name}</button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="add-pairing">
                                <span className="add-radar"><Radar className="w-7 h-7" /></span>
                                <strong>{time}</strong>
                                <p>{t('addDevice.pairingActive')}</p>
                            </div>
                        )}
                        {foundList}
                    </>
                )}

                {step.kind === 'external' && (
                    <>
                        <p className="zone-dialog-hint">{t(`addDevice.external.${step.providerId}`, { name: name(step.providerId) })}</p>
                        {known && found.length === 0 && <p className="add-none">{t('addDevice.noneYet')}</p>}
                        {foundList}
                    </>
                )}

                {error && <p className="connect-error">{error}</p>}

                {step.kind !== 'choose' && (
                    <footer>
                        <span style={{ flex: 1 }} />
                        {step.kind === 'pairing' && secondsLeft === null && (
                            <button className="connect-primary zone-save" disabled={!hubId || busy} onClick={beginPairing}>
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />} {t('addDevice.startPairing')}
                            </button>
                        )}
                        {step.kind === 'pairing' && secondsLeft !== null && (
                            <button className="service-action" onClick={() => void finishPairing()}>{t('addDevice.stopPairing')}</button>
                        )}
                        {step.kind === 'external' && (
                            <>
                                <button className="header-btn add-search" disabled={busy} onClick={search} title={t('addDevice.search')} aria-label={t('addDevice.search')}>
                                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                                </button>
                                <button className="connect-primary zone-save" disabled={busy} onClick={() => openService(step.providerId)}>
                                    <ExternalLink className="w-4 h-4" /> {t('addDevice.openService', { name: name(step.providerId) })}
                                </button>
                            </>
                        )}
                    </footer>
                )}
            </div>
        </div>,
        document.body,
    );
};
