// ==UserScript==
// @name         Ome.tv IP Geolocation Safe (v2.1)
// @namespace    https://github.com/Tapetenputzer/Ome.tv-IP-geolocation
// @version      2.1
// @description  Ome.tv IP Geolocation – Safe version that doesn't interfere with page loading
// @author       taptenputzer
// @match        https://ome.tv/*
// @icon         https://www.google.com/s2/favicons?domain=ome.tv
// @license      MIT License
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Sicherheitscheck - Script nur laden wenn Seite vollständig geladen
    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
        document.addEventListener('DOMContentLoaded', initScript);
        return;
    }

    // Minimale Verzögerung um sicherzustellen, dass die Seite vollständig geladen ist
    setTimeout(initScript, 1000);

    function initScript() {
        try {
            // Konfiguration
            const CONFIG = {
                apiKey: "2f1708b3bb82a3", // Ersetze mit deinem ipinfo.io API-Key
                refreshInterval: 3000, // Längeres Intervall um Last zu reduzieren
                cacheTime: 300000 // 5 Minuten Cache
            };

            // Globale Variablen
            const ipCache = new Map();
            let lastIp = null;
            let currentIp = null;
            let isCollapsed = false;
            let panel = null;

            // Sichere Styling-Injection
            function injectStyles() {
                if (document.getElementById('tap-geo-styles')) return; // Bereits vorhanden

                const style = document.createElement('style');
                style.id = 'tap-geo-styles';
                style.textContent = `
                #tap-geo-panel {
                    position: fixed !important;
                    bottom: 20px !important;
                    right: 20px !important;
                    width: 300px !important;
                    background: rgba(255,255,255,0.95) !important;
                    border: 1px solid #ddd !important;
                    border-radius: 8px !important;
                    padding: 0 !important;
                    font-family: monospace !important;
                    font-size: 12px !important;
                    z-index: 999999 !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
                    overflow: hidden !important;
                    transition: all 0.3s ease !important;
                }

                #tap-geo-panel.collapsed {
                    height: 35px !important;
                }

                #tap-geo-header {
                    background: #2196F3 !important;
                    color: white !important;
                    padding: 8px 12px !important;
                    font-weight: bold !important;
                    cursor: pointer !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    user-select: none !important;
                }

                #tap-geo-content {
                    max-height: 300px !important;
                    overflow-y: auto !important;
                    transition: all 0.3s ease !important;
                }

                #tap-geo-panel.collapsed #tap-geo-content {
                    max-height: 0 !important;
                    overflow: hidden !important;
                }

                #tap-geo-panel table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                }

                #tap-geo-panel th {
                    text-align: left !important;
                    padding: 6px 10px !important;
                    font-weight: bold !important;
                    color: #333 !important;
                    width: 40% !important;
                    background: #f5f5f5 !important;
                }

                #tap-geo-panel td {
                    padding: 6px 10px !important;
                    color: #000 !important;
                    word-break: break-word !important;
                }

                .status-dot {
                    display: inline-block !important;
                    width: 6px !important;
                    height: 6px !important;
                    border-radius: 50% !important;
                    margin-right: 6px !important;
                }

                .status-online { background: #4CAF50 !important; }
                .status-loading { background: #FFC107 !important; }
                .status-error { background: #F44336 !important; }

                .collapse-btn {
                    background: none !important;
                    border: none !important;
                    color: white !important;
                    cursor: pointer !important;
                    font-size: 14px !important;
                    width: 20px !important;
                    height: 20px !important;
                }
                `;

                document.head.appendChild(style);
            }

            // Panel erstellen
            function createPanel() {
                if (panel) return; // Bereits erstellt

                panel = document.createElement('div');
                panel.id = 'tap-geo-panel';

                const header = document.createElement('div');
                header.id = 'tap-geo-header';
                header.innerHTML = `
                    <div>
                        <span class="status-dot status-loading"></span>
                        <span>IP Location</span>
                    </div>
                    <button class="collapse-btn">−</button>
                `;

                const content = document.createElement('div');
                content.id = 'tap-geo-content';
                content.innerHTML = '<div style="padding: 10px; text-align: center; color: #666;">Waiting for connection...</div>';

                panel.appendChild(header);
                panel.appendChild(content);

                // Sichere Injection ins DOM
                try {
                    document.body.appendChild(panel);
                } catch (e) {
                    console.error('[Geolocation] Failed to inject panel:', e);
                    return;
                }

                // Event-Listener
                header.addEventListener('click', (e) => {
                    if (e.target.classList.contains('collapse-btn')) {
                        isCollapsed = !isCollapsed;
                        panel.classList.toggle('collapsed', isCollapsed);
                        e.target.textContent = isCollapsed ? '+' : '−';
                    }
                });
            }

            // Status-Update
            function updateStatus(status) {
                if (!panel) return;

                const dot = panel.querySelector('.status-dot');
                if (dot) {
                    dot.className = `status-dot status-${status}`;
                }
            }

            // Panel-Inhalt aktualisieren
            function updatePanelContent(dataObj) {
                if (!panel) return;

                const content = panel.querySelector('#tap-geo-content');
                if (!content) return;

                const table = document.createElement('table');

                Object.entries(dataObj).forEach(([key, val]) => {
                    const row = document.createElement('tr');
                    const th = document.createElement('th');
                    th.textContent = key;
                    const td = document.createElement('td');
                    td.textContent = val || 'N/A';
                    row.appendChild(th);
                    row.appendChild(td);
                    table.appendChild(row);
                });

                content.innerHTML = '';
                content.appendChild(table);
            }

            // Cache-Funktionen
            function getCachedData(ip) {
                const cached = ipCache.get(ip);
                if (cached && Date.now() - cached.timestamp < CONFIG.cacheTime) {
                    return cached.data;
                }
                return null;
            }

            function setCachedData(ip, data) {
                ipCache.set(ip, {
                    data: data,
                    timestamp: Date.now()
                });
            }

            // Country name helper
            function getCountryName(code) {
                try {
                    const regionNames = new Intl.DisplayNames(['de'], { type: 'region' });
                    return regionNames.of(code.toUpperCase());
                } catch {
                    return code;
                }
            }

            // Geolocation
            async function getLocation(ip) {
                if (!ip || !CONFIG.apiKey || CONFIG.apiKey === "DEIN_API_KEY_HIER") {
                    updateStatus('error');
                    return;
                }

                updateStatus('loading');

                // Cache prüfen
                const cached = getCachedData(ip);
                if (cached) {
                    updatePanelContent(cached);
                    updateStatus('online');
                    return;
                }

                try {
                    const response = await fetch(`https://ipinfo.io/${ip}?token=${CONFIG.apiKey}`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const json = await response.json();

                    const data = {
                        "IP": json.ip,
                        "Country": getCountryName(json.country),
                        "Region": json.region,
                        "City": json.city,
                        "ISP": json.org,
                        "Location": json.loc
                    };

                    updatePanelContent(data);
                    setCachedData(ip, data);
                    updateStatus('online');

                } catch (error) {
                    console.warn('[Geolocation] API request failed:', error.message);
                    updateStatus('error');
                }
            }

            // WebRTC Hook - Sehr vorsichtig implementiert
            function setupWebRTCHook() {
                try {
                    const OriginalRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
                    if (!OriginalRTC) return;

                    const originalAddCandidate = OriginalRTC.prototype.addIceCandidate;
                    if (!originalAddCandidate) return;

                    OriginalRTC.prototype.addIceCandidate = function(candidate, ...args) {
                        // Async handling um Blocking zu vermeiden
                        setTimeout(() => {
                            try {
                                const candidateStr = candidate?.candidate || '';
                                const ipMatch = candidateStr.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
                                const typeMatch = candidateStr.match(/typ\s+(srflx)/);

                                if (typeMatch && ipMatch) {
                                    const ip = ipMatch[1];

                                    // Lokale IPs ausschließen
                                    if (!ip.startsWith('192.168.') &&
                                        !ip.startsWith('10.') &&
                                        !ip.startsWith('172.') &&
                                        !ip.startsWith('127.') &&
                                        ip !== lastIp) {

                                        lastIp = ip;
                                        currentIp = ip;
                                        getLocation(ip);
                                    }
                                }
                            } catch (e) {
                                // Stil ignorieren um Seitenfunction nicht zu beeinträchtigen
                            }
                        }, 0);

                        // Original-Funktion normal aufrufen
                        return originalAddCandidate.call(this, candidate, ...args);
                    };

                    // toString beibehalten für native Darstellung
                    OriginalRTC.prototype.addIceCandidate.toString = function() {
                        return 'function addIceCandidate() { [native code] }';
                    };

                } catch (error) {
                    console.error('[Geolocation] WebRTC hook failed:', error);
                }
            }

            // Neustart-Button verstecken (minimal)
            function hideRestartButtons() {
                try {
                    document.querySelectorAll('button, a').forEach(el => {
                        const text = el.textContent?.toLowerCase();
                        if (text && text.includes('neustart')) {
                            el.style.display = 'none';
                        }
                    });
                } catch (e) {
                    // Ignorieren
                }
            }

            // Periodische Updates
            let updateInterval = null;
            function startUpdates() {
                if (updateInterval) return;

                updateInterval = setInterval(() => {
                    if (currentIp && !getCachedData(currentIp)) {
                        getLocation(currentIp);
                    }
                    hideRestartButtons();
                }, CONFIG.refreshInterval);
            }

            // Cleanup
            function cleanup() {
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
                ipCache.clear();
            }

            // Initialisierung
            function initialize() {
                injectStyles();
                createPanel();
                setupWebRTCHook();
                hideRestartButtons();
                startUpdates();

                // Cleanup bei Seitenwechsel
                window.addEventListener('beforeunload', cleanup);

                console.log('[Geolocation] Safe script loaded');
            }

            // Starte Initialisierung
            initialize();

        } catch (error) {
            console.error('[Geolocation] Script initialization failed:', error);
        }
    }

})();
