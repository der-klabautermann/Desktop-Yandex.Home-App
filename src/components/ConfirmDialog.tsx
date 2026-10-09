import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Trash2, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

interface ConfirmDialogProps {
    title: string;
    text: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
    onClose: () => void;
}

/** Подтверждение необратимого действия (удаление). */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, text, confirmLabel, onConfirm, onClose }) => {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);

    const confirm = async () => {
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); }
    };

    return createPortal(
        <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="zone-dialog" role="alertdialog" aria-label={title}>
                <header>
                    <h3>{title}</h3>
                    <button className="header-btn" onClick={onClose} disabled={busy} title={t('common.close')}><X className="w-4 h-4" /></button>
                </header>
                <p className="zone-dialog-hint">{text}</p>
                <footer>
                    <span style={{ flex: 1 }} />
                    <button className="service-action" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
                    <button className="dp-delete-confirm" onClick={confirm} disabled={busy}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {confirmLabel}
                    </button>
                </footer>
            </div>
        </div>,
        document.body,
    );
};
