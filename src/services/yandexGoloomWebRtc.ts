import { YandexWebRtcRoom } from '../types/index';

const CONNECTION_TIMEOUT_MS = 90000;
const VIDEO_TIMEOUT_MS = 30000;
/** Interval for application-level pings to prevent NAT/idle WS timeouts */
const KEEPALIVE_INTERVAL_MS = 25000;
/** Refresh credentials this many ms before JWT expiry */
const JWT_REFRESH_LEAD_MS = 60000;
/** Retry staging connect when server reports too many peers (overlap with old session) */
const TOO_MANY_PEERS_RETRY_MS = 4000;
/** Fast-path may reuse cached room JWT only if it remains valid at least this long */
export const JWT_FAST_REUSE_MIN_TTL_MS = 90_000;

const log = (...args: unknown[]) => console.log('[Goloom]', ...args);
const logErr = (...args: unknown[]) => console.error('[Goloom]', ...args);

/**
 * Decode the `exp` field of a JWT (returns ms-since-epoch or null if not decodable).
 * Works for standard JWT and Yandex Goloom room tokens.
 */
const decodeJwtExp = (jwt: string): number | null => {
    try {
        const parts = jwt.split('.');
        if (parts.length < 2) return null;
        // base64url → base64
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
        return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
};

const waitForWsOpen = (ws: WebSocket) => new Promise<void>((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
    }
    ws.addEventListener('open', () => { log('WS opened'); resolve(); }, { once: true });
    ws.addEventListener('error', (e) => {
        logErr('WS open error', e);
        reject(new Error('CAM_CONNECT_FAILED'));
    }, { once: true });
});

const readWsMessage = (ws: WebSocket) => new Promise<string>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => { cleanup(); resolve(typeof event.data === 'string' ? event.data : ''); };
    const onError = () => { cleanup(); reject(new Error('CAM_CONNECT_FAILED')); };
    const onClose = () => { cleanup(); reject(new Error('CAM_CONNECT_FAILED')); };
    const cleanup = () => {
        ws.removeEventListener('message', onMessage);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onClose);
    };
    ws.addEventListener('message', onMessage);
    ws.addEventListener('error', onError);
    ws.addEventListener('close', onClose);
});

// Resolves on ICE connected OR full connection connected (whichever comes first)
const waitForPeerConnected = (pc: RTCPeerConnection) => new Promise<void>((resolve, reject) => {
    let done = false;

    const timeout = window.setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        logErr('WebRTC connection timeout, last connectionState:', pc.connectionState, 'ICE:', pc.iceConnectionState);
        reject(new Error('CAM_CONNECT_FAILED'));
    }, CONNECTION_TIMEOUT_MS);

    let iceConnectedAt = 0;

    const tryResolve = () => {
        if (done) return;
        const cs = pc.connectionState;
        const ice = pc.iceConnectionState;
        log('connectionState ->', cs, '| iceConnectionState ->', ice);

        if (cs === 'connected') {
            done = true;
            cleanup();
            resolve();
            return;
        }

        if (ice === 'connected' || ice === 'completed') {
            if (!iceConnectedAt) {
                iceConnectedAt = Date.now();
                // Give DTLS up to 5s to finish after ICE; resolve anyway after that
                window.setTimeout(() => {
                    if (done) return;
                    log('DTLS did not complete 5s after ICE — resolving anyway, connectionState:', pc.connectionState);
                    done = true;
                    cleanup();
                    resolve();
                }, 5000);
            }
        }

        if (cs === 'failed' || cs === 'closed' || ice === 'failed') {
            done = true;
            cleanup();
            reject(new Error(`WebRTC: ${cs} / ICE: ${ice}`));
        }
    };

    const cleanup = () => {
        window.clearTimeout(timeout);
        pc.removeEventListener('connectionstatechange', tryResolve);
        pc.removeEventListener('iceconnectionstatechange', tryResolve);
    };

    pc.addEventListener('connectionstatechange', tryResolve);
    pc.addEventListener('iceconnectionstatechange', tryResolve);
    tryResolve();
});

const waitForVideoFrame = (video: HTMLVideoElement) => new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
        cleanup();
        logErr('No video frames after', VIDEO_TIMEOUT_MS / 1000, 's. videoWidth:', video.videoWidth, 'readyState:', video.readyState);
        reject(new Error('CAM_NO_VIDEO'));
    }, VIDEO_TIMEOUT_MS);

    const checkReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            log('Video frame received:', video.videoWidth, 'x', video.videoHeight);
            cleanup();
            resolve();
        }
    };

    const onLoadedData = () => { log('video loadeddata', video.videoWidth, 'x', video.videoHeight); checkReady(); };
    const onPlaying = () => { log('video playing', video.videoWidth, 'x', video.videoHeight); checkReady(); };
    const onResize = () => { log('video resize:', video.videoWidth, 'x', video.videoHeight); checkReady(); };

    const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('resize', onResize);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('resize', onResize);
    checkReady();
});

export { waitForVideoFrame, TOO_MANY_PEERS_RETRY_MS };

const sendAck = (ws: WebSocket, uid: string) => {
    ws.send(JSON.stringify({ uid, ack: { status: { code: 'OK' } } }));
};

const handleSignalingMessage = async (
    raw: string,
    pc: RTCPeerConnection,
    ws: WebSocket,
    pendingCandidates: RTCIceCandidateInit[],
    state: { remoteDescSet: boolean },
    onSlotsConfig?: (mid: string) => void,
) => {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    const keys = Object.keys(msg).filter(k => k !== 'uid');
    if (keys.length > 0) {
        log('recv:', keys.join(', '));
    }

    if ('slotsConfig' in msg) {
        const cfg = msg.slotsConfig as {
            slots?: Array<{ participantVideoByMid?: { mid?: string; limitationReason?: string } }>;
        } | undefined;
        const slot = cfg?.slots?.find(s => s.participantVideoByMid?.mid);
        const mid = slot?.participantVideoByMid?.mid ?? '';
        const limitation = slot?.participantVideoByMid?.limitationReason ?? '';
        // Only log when mid or limitation actually changes to avoid flooding the console
        const sigKey = `${mid}|${limitation}`;
        if ((handleSignalingMessage as { _lastSlotsKey?: string })._lastSlotsKey !== sigKey) {
            (handleSignalingMessage as { _lastSlotsKey?: string })._lastSlotsKey = sigKey;
            log('slotsConfig: mid=', mid || '(empty)', '| limitationReason=', limitation || '(none)');
        }
        onSlotsConfig?.(mid);
    }

    if (msg.subscriberSdpOffer) {
        const offer = msg.subscriberSdpOffer as { pcSeq: number; sdp: string };
        // Extract codec info from SDP for diagnostics
        const videoLine = offer.sdp.split('\n').find(l => l.startsWith('m=video'));
        const codecLines = offer.sdp.split('\n').filter(l => l.includes('VP8') || l.includes('VP9') || l.includes('H264') || l.includes('AV1') || l.includes('rtpmap'));
        log('SDP offer received, pcSeq:', offer.pcSeq, '| video m-line:', videoLine?.trim(), '| codecs:', codecLines.slice(0, 4).map(l => l.trim()).join(' / '));
        await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
        state.remoteDescSet = true;

        for (const c of pendingCandidates.splice(0)) {
            try { await pc.addIceCandidate(c); } catch { /* ignore */ }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        log('SDP answer sent');
        ws.send(JSON.stringify({
            uid: crypto.randomUUID(),
            subscriberSdpAnswer: { pcSeq: offer.pcSeq, sdp: answer.sdp },
        }));
    }

    if (msg.webrtcIceCandidate) {
        const candidate = msg.webrtcIceCandidate as {
            candidate: string; sdpMid: string; sdpMlineIndex: number;
        };
        if (candidate.candidate) {
            const init: RTCIceCandidateInit = {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMlineIndex,
            };
            if (!state.remoteDescSet) {
                log('queuing ICE candidate');
                pendingCandidates.push(init);
            } else {
                try { await pc.addIceCandidate(init); } catch (e) { logErr('addIceCandidate error:', e); }
            }
        }
    }

    // Detect server error messages mid-session (e.g. too many peers, room closed)
    if ('error' in msg || 'serverError' in msg || 'errorMessage' in msg) {
        const errPayload = msg.error ?? msg.serverError ?? msg.errorMessage;
        if (errPayload) {
            const reason = typeof errPayload === 'string' ? errPayload : JSON.stringify(errPayload);
            logErr('Server error message:', reason);
            const isTooManyPeers = /too.?many.?peer/i.test(reason);
            throw new Error(
                isTooManyPeers
                    ? 'CAM_TOO_MANY'
                    : `CAM_SERVER_ERROR ${reason}`,
            );
        }
    }

    if (msg.uid && msg.ack == null) {
        sendAck(ws, String(msg.uid));
    }
};

export interface GoloomConnection {
    /** Unique id — only the active connection should handle JWT refresh. */
    id: string;
    /** Full cleanup — stops stream and clears the video element. */
    cleanup: () => void;
    /** Soft cleanup — stops the WebSocket/PeerConnection but keeps the last video frame visible. */
    cleanupSoft: () => void;
    setQuality: (width: number, height: number) => void;
}

export const connectYandexGoloomWebRtc = async (
    room: YandexWebRtcRoom,
    video: HTMLVideoElement,
    onDisconnect?: () => void,
    initialQuality: { width: number; height: number } = { width: 2560, height: 1440 },
    onCredentialRefresh?: (cleanupOld: () => void, connectionId: string) => boolean | Promise<boolean>,
): Promise<GoloomConnection> => {
    const connectionId = crypto.randomUUID();
    const pendingCandidates: RTCIceCandidateInit[] = [];
    const state = { remoteDescSet: false };
    let closed = false;
    let intentionalClose = false;

    // Map of transceiver mid → MediaStream, populated by ontrack
    const videoStreams = new Map<string, MediaStream>();
    // All received audio tracks
    const audioTracks: MediaStreamTrack[] = [];

    // Promise that resolves when server sends slotsConfig with an actual mid assigned
    let slotsConfigResolve: ((mid: string) => void) | null = null;
    const slotsConfigPromise = new Promise<string>(resolve => { slotsConfigResolve = resolve; });

    // Timers cleared on cleanup
    let keepaliveIntervalId: ReturnType<typeof setInterval> | null = null;
    let jwtRefreshTimerId: ReturnType<typeof setTimeout> | null = null;
    let upgradeTimerId: ReturnType<typeof setTimeout> | null = null;

    const doCleanup = (ws: WebSocket, pc: RTCPeerConnection, unexpected = false, keepVideo = false) => {
        if (closed) return;
        closed = true;
        if (keepaliveIntervalId !== null) { window.clearInterval(keepaliveIntervalId); keepaliveIntervalId = null; }
        if (jwtRefreshTimerId !== null) { window.clearTimeout(jwtRefreshTimerId); jwtRefreshTimerId = null; }
        if (upgradeTimerId !== null) { window.clearTimeout(upgradeTimerId); upgradeTimerId = null; }
        log('Cleanup', keepVideo ? '(keeping video frame)' : '');
        pc.close();
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        if (!keepVideo) video.srcObject = null;
        if (unexpected) onDisconnect?.();
    };

    /** Read frame width via track settings or inbound-rtp stats — no extra <video> elements. */
    const probeTrackFrameWidth = async (track: MediaStreamTrack, rtpPc: RTCPeerConnection): Promise<number> => {
        if (closed) return 0;

        const settings = track.getSettings?.();
        if (settings?.width && settings.width > 0) {
            return settings.width;
        }

        const receiver = rtpPc.getReceivers().find(r => r.track?.id === track.id);
        if (!receiver) return 0;

        for (let attempt = 0; attempt < 10; attempt++) {
            if (closed) return 0;
            const stats = await receiver.getStats();
            for (const report of stats.values()) {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    const w = (report as RTCInboundRtpStreamStats).frameWidth;
                    if (w && w > 0) return w;
                }
            }
            await new Promise(r => window.setTimeout(r, 200));
        }
        return 0;
    };

    log('Connecting to', room.serviceUrl);
    const ws = new WebSocket(room.serviceUrl);

    // Log WS close details to diagnose why the connection drops
    ws.addEventListener('close', (e) => {
        log('WS closed — code:', e.code, '| reason:', e.reason || '(none)', '| wasClean:', e.wasClean);
    });

    await waitForWsOpen(ws);

    const hello = {
        hello: {
            credentials: room.credentials,
            participantId: room.participantId,
            roomId: room.roomId,
            serviceName: room.serviceName,
            sdkInitializationId: crypto.randomUUID(),
            capabilitiesOffer: {},
            sendAudio: false,
            sendSharing: false,
            sendVideo: false,
            sdkInfo: { hwConcurrency: 4, implementation: 'browser', version: '5.4.0' },
            participantAttributes: { description: '', name: 'mike', role: 'SPEAKER' },
            participantMeta: {
                description: '', name: 'mike', role: 'SPEAKER',
                sendAudio: false, sendVideo: false,
            },
        },
        uid: crypto.randomUUID(),
    };
    ws.send(JSON.stringify(hello));
    log('hello sent, waiting serverHello...');

    const serverHelloRaw = await readWsMessage(ws);
    try {
        const sh = JSON.parse(serverHelloRaw) as Record<string, unknown>;
        log('serverHello keys:', Object.keys(sh).join(', '));

        // Detect server-side rejection (e.g. "too many peers")
        const inner = (sh.serverHello ?? sh) as Record<string, unknown>;
        const status = inner.status as Record<string, unknown> | undefined;
        const errField = inner.error ?? sh.error;

        let serverError: string | null = null;
        if (status && status.code && status.code !== 'OK') {
            serverError = String(status.reason ?? status.message ?? status.code);
        } else if (errField) {
            serverError = typeof errField === 'string' ? errField : JSON.stringify(errField);
        }

        if (serverError) {
            logErr('serverHello rejected:', serverError);
            closed = true;
            ws.close();
            const isTooManyPeers = /too.?many.?peer/i.test(serverError);
            throw new Error(
                isTooManyPeers
                    ? 'CAM_TOO_MANY'
                    : `CAM_SERVER_ERROR ${serverError}`,
            );
        }
    } catch (e) {
        if (e instanceof Error && (e.message.startsWith('CAM_TOO_MANY') || e.message.startsWith('CAM_SERVER_ERROR'))) throw e;
        log('serverHello (raw):', serverHelloRaw.slice(0, 200));
    }

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    });
    log('RTCPeerConnection created');

    pc.ontrack = (event) => {
        if (closed) return;
        const t = event.track;
        const txMid = event.transceiver?.mid ?? '';
        log('ontrack kind:', t.kind, '| mid:', txMid || '(empty)', '| id:', t.id.slice(0, 8), '| enabled:', t.enabled, '| readyState:', t.readyState, '| streams:', event.streams.length);
        if (t.kind === 'video') {
            const stream = event.streams[0] ?? new MediaStream([t]);
            videoStreams.set(txMid, stream);
            log('Stored video stream for mid:', txMid || '(empty)', '| stream id:', stream.id.slice(0, 8));
            if (videoStreams.size === 1 && !closed) {
                log('Setting initial srcObject from first video track');
                video.srcObject = stream;
                video.muted = false;
            }
        } else if (t.kind === 'audio') {
            audioTracks.push(t);
            log('Stored audio track, total:', audioTracks.length);
        }
        t.addEventListener('ended', () => logErr('track ended, kind:', t.kind, '| mid:', txMid));
    };

    pc.onicecandidate = (event) => {
        if (!event.candidate) {
            log('ICE gathering complete');
            return;
        }
        ws.send(JSON.stringify({
            uid: crypto.randomUUID(),
            webrtcIceCandidate: {
                pcSeq: 0,
                target: 'SUBSCRIBER',
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMlineIndex: event.candidate.sdpMLineIndex,
            },
        }));
    };

    const messageLoop = (async () => {
        while (!closed && ws.readyState === WebSocket.OPEN) {
            const raw = await readWsMessage(ws);
            await handleSignalingMessage(raw, pc, ws, pendingCandidates, state, (mid) => {
            if (mid) slotsConfigResolve?.(mid);
        });
        }
    })();

    messageLoop.catch((err) => {
        if (intentionalClose) return;
        logErr('messageLoop error:', err);
        doCleanup(ws, pc, true);
    });

    try {
        log('Waiting for peer connection (up to', CONNECTION_TIMEOUT_MS / 1000, 's)...');
        await waitForPeerConnected(pc);
        log('Connected! Sending setSlots...');

        ws.send(JSON.stringify({
            uid: crypto.randomUUID(),
            setSlots: {
                slots: [{ width: initialQuality.width, height: initialQuality.height }],
                audioSlotsCount: 0,
                key: 1,
                shutdownAllVideo: false,
                withSelfView: false,
                selfViewVisibility: 'ON_LOADING_THEN_HIDE',
                gridConfig: {},
            },
        }));

        // Wait for slotsConfig with a real mid assigned — or actual video frames
        const slotsTimeout = new Promise<string>((_, reject) =>
            window.setTimeout(() => reject(new Error('CAM_SERVER_ERROR slots')), VIDEO_TIMEOUT_MS));

        const videoFramePromise = waitForVideoFrame(video).then(() => '');

        const assignedMid = await Promise.race([
            slotsConfigPromise,
            videoFramePromise,
            slotsTimeout,
        ]);

        log('Stream confirmed. assignedMid:', assignedMid || '(from video frame)', '| connectionState:', pc.connectionState);

        // Build a combined stream: correct video track + all audio tracks
        {
            let videoTrack: MediaStreamTrack | undefined;
            if (assignedMid) {
                const targetStream = videoStreams.get(assignedMid)
                    ?? [...videoStreams.values()][0];
                if (targetStream) {
                    videoTrack = targetStream.getVideoTracks()[0];
                    log('Using video track from mid:', assignedMid, '| track id:', videoTrack?.id.slice(0, 8));
                } else {
                    log('No stream found for mid:', assignedMid, '— keeping current srcObject');
                }
            } else {
                // Came from video frame — use the first available stream from newly received tracks
                videoTrack = [...videoStreams.values()][0]?.getVideoTracks()[0];
            }

            if (videoTrack) {
                const combined = new MediaStream();
                combined.addTrack(videoTrack);
                for (const at of audioTracks) {
                    combined.addTrack(at);
                    log('Added audio track to combined stream, id:', at.id.slice(0, 8));
                }
                log('Switching srcObject to combined stream: video+', audioTracks.length, 'audio track(s)');
                if (!closed) {
                    video.srcObject = combined;
                    video.muted = false;
                }
            }
        }

        // Probe available streams and pick the highest-resolution track (via getStats, not temp <video>).
        const upgradeToHighestQuality = async () => {
            if (closed) return;
            let bestWidth = video.videoWidth;
            let bestTrack: MediaStreamTrack | undefined;
            let bestMid = '';
            for (const [mid, stream] of videoStreams) {
                if (closed) return;
                const track = stream.getVideoTracks()[0];
                if (!track || track.readyState !== 'live') continue;
                const w = await probeTrackFrameWidth(track, pc);
                if (closed) return;
                log('Probed mid:', mid, '→', w, 'x (current best:', bestWidth, ')');
                if (w > bestWidth) {
                    bestWidth = w;
                    bestTrack = track;
                    bestMid = mid;
                }
            }
            if (!bestTrack || closed) return;
            log('Upgrading to higher quality track, mid:', bestMid, 'width:', bestWidth);
            const combined = new MediaStream([bestTrack, ...audioTracks]);
            video.srcObject = combined;
            video.muted = false;
            try { await video.play(); } catch { /* ignore */ }
        };

        log('video state BEFORE play:', video.srcObject ? `stream(${(video.srcObject as MediaStream).getTracks().map(t => `${t.kind}:${t.readyState}:enabled=${t.enabled}`).join(',')})` : 'null', '| readyState:', video.readyState, '| videoWidth:', video.videoWidth);

        // Give browser a moment to process SRTP after DTLS
        await new Promise(r => window.setTimeout(r, 500));

        try { await video.play(); } catch { /* ignore AbortError */ }

        log('video state AFTER play: readyState:', video.readyState, '| videoWidth:', video.videoWidth, '| paused:', video.paused);

        if (video.videoWidth === 0) {
            log('videoWidth is 0 — camera may be in privacy mode, DTLS incomplete, or codec unsupported');
        }

        // Auto-upgrade only when high quality was requested (not when user intentionally chose low)
        const isHighQualityRequest = initialQuality.width === 0 || initialQuality.width >= 1920;
        if (isHighQualityRequest) {
            upgradeTimerId = window.setTimeout(() => { void upgradeToHighestQuality(); }, 1000);
        }

        // ── Keepalive ────────────────────────────────────────────────────────────
        // Send a JSON ping every 25 s so NAT/firewalls and the Goloom server don't
        // treat the signaling WS as idle and close it.
        keepaliveIntervalId = window.setInterval(() => {
            if (closed || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ uid: crypto.randomUUID(), ping: {} }));
        }, KEEPALIVE_INTERVAL_MS);

        // ── Proactive JWT refresh ─────────────────────────────────────────────
        // Room credentials are a short-lived JWT (~5 min).  Before it expires we
        // trigger a reconnect that must fetch fresh credentials via create-room.
        const jwtExp = decodeJwtExp(room.credentials);
        if (jwtExp !== null) {
            const msLeft = jwtExp - Date.now();
            const refreshIn = msLeft - JWT_REFRESH_LEAD_MS;
            log(`JWT exp in ${Math.round(msLeft / 1000)} s — proactive refresh scheduled in ${Math.round(refreshIn / 1000)} s`);
            const triggerCredentialRefresh = () => {
                if (closed) return;
                log('JWT expiring soon — triggering seamless credential refresh');
                const cleanupOld = () => doCleanup(ws, pc, false, true);
                if (onCredentialRefresh) {
                    void Promise.resolve(onCredentialRefresh(cleanupOld, connectionId))
                        .then((accepted) => {
                            if (closed) return;
                            if (accepted === false) return;
                            intentionalClose = true;
                        })
                        .catch((err) => {
                            logErr('credential refresh failed:', err);
                            if (!closed) {
                                cleanupOld();
                                onDisconnect?.();
                            }
                        });
                } else {
                    intentionalClose = true;
                    cleanupOld();
                    onDisconnect?.();
                }
            };
            if (refreshIn > 5000) {
                jwtRefreshTimerId = window.setTimeout(triggerCredentialRefresh, refreshIn);
            } else if (msLeft > 5000) {
                jwtRefreshTimerId = window.setTimeout(triggerCredentialRefresh, 1000);
            } else {
                log('JWT nearly expired on connect — will rely on disconnect handler');
            }
        } else {
            log('JWT exp not found in credentials — relying on server-close for reconnect');
        }

        const setQuality = (width: number, height: number) => {
            if (closed || ws.readyState !== WebSocket.OPEN) return;
            log('Changing quality to', width, 'x', height);
            ws.send(JSON.stringify({
                uid: crypto.randomUUID(),
                setSlots: {
                    slots: [{ width, height }],
                    audioSlotsCount: 0,
                    key: Date.now(),
                    shutdownAllVideo: false,
                    withSelfView: false,
                    selfViewVisibility: 'ON_LOADING_THEN_HIDE',
                    gridConfig: {},
                },
            }));
        };

        return {
            id: connectionId,
            cleanup: () => doCleanup(ws, pc),
            cleanupSoft: () => doCleanup(ws, pc, false, true),
            setQuality,
        };
    } catch (err) {
        doCleanup(ws, pc);
        throw err;
    }
};
