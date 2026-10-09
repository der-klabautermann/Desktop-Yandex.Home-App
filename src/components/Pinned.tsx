import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/** Место под заголовком, которое не прокручивается вместе с содержимым. */
export const PinnedContext = createContext<HTMLElement | null>(null);

/** Переносит содержимое (сводку, общие кнопки) в неподвижную шапку панели. */
export const Pinned: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const target = useContext(PinnedContext);
    return target ? createPortal(children, target) : <>{children}</>;
};
