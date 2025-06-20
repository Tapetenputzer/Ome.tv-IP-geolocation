// ==UserScript==
// @name         Ome.tv IP Geolocation made by Tapetenputzer (v2.3)
// @namespace    https://github.com/Tapetenputzer/Ome.tv-IP-geolocation
// @version      2.3
// @description  Ome.tv IP Geolocation – Enhanced version with comprehensive IP information
// @author       taptenputzer
// @match        https://ome.tv/*
// @icon         https://www.google.com/s2/favicons?domain=ome.tv
// @license      MIT License
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
        document.addEventListener('DOMContentLoaded', initScript);
        return;
    }

    setTimeout(initScript, 1000);

    function initScript() {
        try {
            const CONFIG = {
                apiKey: "2f1708b3bb82a3",
                refreshInterval: 2000,
                cacheTime: 60000,
                retryDelay: 1000
            };

            const ipCache = new Map();
            const ipHistory = new Set();
            let lastIp = null;
            let currentIp = null;
            let isCollapsed = false;
            let panel = null;
            let retryCount = 0;
            let maxRetries = 3;

            function injectStyles() {
                if (document.getElementById('tap-geo-styles')) return;

                const style = document.createElement('style');
                style.id = 'tap-geo-styles';
                style.textContent = `
                #tap-geo-panel {
                    position: fixed !important;
                    bottom: 20px !important;
                    right: 20px !important;
                    width: 380px !important;
                    background: rgba(255,255,255,0.98) !important;
                    border: 1px solid #ddd !important;
                    border-radius: 12px !important;
                    padding: 0 !important;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                    font-size: 11px !important;
                    z-index: 999999 !important;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
                    overflow: hidden !important;
                    transition: all 0.3s ease !important;
                    backdrop-filter: blur(10px) !important;
                }

                #tap-geo-panel.collapsed {
                    height: 45px !important;
                }

                #tap-geo-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                    color: white !important;
                    padding: 12px 15px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    user-select: none !important;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1) !important;
                }

                #tap-geo-content {
                    max-height: 450px !important;
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
                    padding: 8px 12px !important;
                    font-weight: 600 !important;
                    color: #2c3e50 !important;
                    width: 30% !important;
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
                    border-bottom: 1px solid #dee2e6 !important;
                    font-size: 10px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.5px !important;
                }

                #tap-geo-panel td {
                    padding: 8px 12px !important;
                    color: #2c3e50 !important;
                    word-break: break-word !important;
                    border-bottom: 1px solid #f1f3f4 !important;
                    font-weight: 500 !important;
                    background: rgba(255,255,255,0.8) !important;
                }

                .status-dot {
                    display: inline-block !important;
                    width: 10px !important;
                    height: 10px !important;
                    border-radius: 50% !important;
                    margin-right: 8px !important;
                    animation: pulse 2s infinite !important;
                    box-shadow: 0 0 8px rgba(0,0,0,0.3) !important;
                }

                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }

                .status-online {
                    background: #27ae60 !important;
                    animation: none !important;
                    box-shadow: 0 0 12px #27ae60 !important;
                }
                .status-loading {
                    background: #f39c12 !important;
                }
                .status-error {
                    background: #e74c3c !important;
                    animation: none !important;
                    box-shadow: 0 0 12px #e74c3c !important;
                }

                .collapse-btn, .refresh-btn {
                    background: rgba(255,255,255,0.2) !important;
                    border: 1px solid rgba(255,255,255,0.3) !important;
                    color: white !important;
                    border-radius: 6px !important;
                    padding: 6px 10px !important;
                    font-size: 12px !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    font-weight: 600 !important;
                }

                .collapse-btn:hover, .refresh-btn:hover {
                    background: rgba(255,255,255,0.3) !important;
                    transform: scale(1.05) !important;
                }

                .refresh-btn {
                    margin-right: 8px !important;
                }

                .ip-verified {
                    color: #27ae60 !important;
                    font-weight: 700 !important;
                    text-shadow: 0 1px 2px rgba(39,174,96,0.3) !important;
                }

                .ip-unverified {
                    color: #e67e22 !important;
                    font-weight: 600 !important;
                }

                .data-source {
                    font-size: 9px !important;
                    color: #7f8c8d !important;
                    font-style: italic !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.3px !important;
                }

                .flag-emoji {
                    font-size: 16px !important;
                    margin-right: 8px !important;
                }

                .security-info {
                    background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%) !important;
                    color: #2c3e50 !important;
                    font-weight: 600 !important;
                }

                .vpn-detected {
                    background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%) !important;
                    color: #d35400 !important;
                    font-weight: 700 !important;
                }

                .mobile-carrier {
                    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%) !important;
                    color: #2c3e50 !important;
                    font-weight: 600 !important;
                }

                .coordinates {
                    font-family: 'Courier New', monospace !important;
                    background: #2c3e50 !important;
                    color: #ecf0f1 !important;
                    padding: 4px 8px !important;
                    border-radius: 4px !important;
                    font-weight: 600 !important;
                }
                `;

                document.head.appendChild(style);
            }

            function createPanel() {
                if (panel) return;

                panel = document.createElement('div');
                panel.id = 'tap-geo-panel';

                const header = document.createElement('div');
                header.id = 'tap-geo-header';
                header.innerHTML = `
                    <div>
                        <span class="status-dot status-loading"></span>
                        <span>🌍 IP Geolocation</span>
                    </div>
                    <div>
                        <button class="refresh-btn" title="Refresh Data">🔄</button>
                        <button class="collapse-btn">−</button>
                    </div>
                `;

                const content = document.createElement('div');
                content.id = 'tap-geo-content';
                content.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d; font-weight: 500;">🔍 Waiting for connection...</div>';

                panel.appendChild(header);
                panel.appendChild(content);

                try {
                    document.body.appendChild(panel);
                } catch (e) {
                    console.error('[Geolocation] Failed to inject panel:', e);
                    return;
                }

                header.addEventListener('click', (e) => {
                    if (e.target.classList.contains('collapse-btn')) {
                        isCollapsed = !isCollapsed;
                        panel.classList.toggle('collapsed', isCollapsed);
                        e.target.textContent = isCollapsed ? '+' : '−';
                    } else if (e.target.classList.contains('refresh-btn') || e.target.textContent === '🔄') {
                        e.stopPropagation();
                        if (currentIp) {
                            ipCache.delete(currentIp);
                            getLocationData(currentIp);
                        }
                    }
                });
            }

            function updateStatus(status) {
                if (!panel) return;

                const dot = panel.querySelector('.status-dot');
                if (dot) {
                    dot.className = `status-dot status-${status}`;
                }
            }

            function getCountryFlag(countryCode) {
                if (!countryCode || countryCode.length !== 2) return '';
                const codePoints = countryCode.toUpperCase().split('').map(char =>
                    127397 + char.charCodeAt()
                );
                return String.fromCodePoint(...codePoints);
            }

            function getCountryName(code) {
                try {
                    const regionNames = new Intl.DisplayNames(['de'], { type: 'region' });
                    return regionNames.of(code.toUpperCase());
                } catch {
                    return code;
                }
            }

            function updatePanelContent(dataObj, verified = false) {
                if (!panel) return;

                const content = panel.querySelector('#tap-geo-content');
                if (!content) return;

                const table = document.createElement('table');

                const dataRows = [
                    {
                        key: 'IP Address',
                        value: dataObj.ip,
                        class: verified ? 'ip-verified' : 'ip-unverified',
                        prefix: verified ? '✅' : '⚠️'
                    },
                    {
                        key: 'Country',
                        value: `${getCountryFlag(dataObj.country_code)} ${dataObj.country}`,
                        class: 'country-info'
                    },
                    {
                        key: 'Region/State',
                        value: dataObj.region || dataObj.state_prov,
                        class: 'region-info'
                    },
                    {
                        key: 'City',
                        value: dataObj.city,
                        class: 'city-info'
                    },
                    {
                        key: 'Postal Code',
                        value: dataObj.zip || dataObj.postal,
                        class: 'postal-info'
                    },
                    {
                        key: 'Coordinates',
                        value: dataObj.lat && dataObj.lon ? `${dataObj.lat}, ${dataObj.lon}` : dataObj.loc,
                        class: 'coordinates'
                    },
                    {
                        key: 'ISP Provider',
                        value: dataObj.isp || dataObj.org,
                        class: 'isp-info'
                    },
                    {
                        key: 'Organization',
                        value: dataObj.org || dataObj.as,
                        class: 'org-info'
                    },
                    {
                        key: 'AS Number',
                        value: dataObj.asn || (dataObj.as && dataObj.as.split(' ')[0]),
                        class: 'asn-info'
                    },
                    {
                        key: 'Timezone',
                        value: dataObj.timezone || (dataObj.time_zone && dataObj.time_zone.name),
                        class: 'timezone-info'
                    },
                    {
                        key: 'UTC Offset',
                        value: dataObj.utc_offset || (dataObj.time_zone && dataObj.time_zone.offset),
                        class: 'utc-info'
                    },
                    {
                        key: 'Connection Type',
                        value: dataObj.connection_type || dataObj.connection,
                        class: 'connection-info'
                    },
                    {
                        key: 'Mobile Carrier',
                        value: dataObj.mobile && dataObj.mobile.carrier_name,
                        class: 'mobile-carrier'
                    },
                    {
                        key: 'Security',
                        value: dataObj.security ?
                            `${dataObj.security.is_proxy ? '🔴 Proxy' : '🟢 Direct'} | ${dataObj.security.is_vpn ? '🔴 VPN' : '🟢 No VPN'} | ${dataObj.security.is_tor ? '🔴 Tor' : '🟢 No Tor'}` :
                            (dataObj.proxy ? '🔴 Proxy Detected' : '🟢 Direct Connection'),
                        class: dataObj.security && (dataObj.security.is_proxy || dataObj.security.is_vpn || dataObj.security.is_tor) ? 'vpn-detected' : 'security-info'
                    },
                    {
                        key: 'Threat Level',
                        value: dataObj.threat ?
                            `${dataObj.threat.is_malicious ? '🔴 Malicious' : '🟢 Clean'} | ${dataObj.threat.is_bot ? '🤖 Bot' : '👤 Human'}` :
                            '🟢 No Threats Detected',
                        class: dataObj.threat && dataObj.threat.is_malicious ? 'vpn-detected' : 'security-info'
                    },
                    {
                        key: 'Currency',
                        value: dataObj.currency ? `${dataObj.currency.name} (${dataObj.currency.code})` : null,
                        class: 'currency-info'
                    },
                    {
                        key: 'Languages',
                        value: dataObj.languages ? dataObj.languages.join(', ') : null,
                        class: 'language-info'
                    },
                    {
                        key: 'Calling Code',
                        value: dataObj.calling_code ? `+${dataObj.calling_code}` : null,
                        class: 'calling-info'
                    },
                    {
                        key: 'Data Source',
                        value: dataObj.source || 'Multi-API',
                        class: 'data-source'
                    },
                    {
                        key: 'Last Updated',
                        value: new Date().toLocaleString('de-DE'),
                        class: 'data-source'
                    }
                ];

                dataRows.forEach(rowData => {
                    if (!rowData.value || rowData.value === 'N/A' || rowData.value === 'undefined' || rowData.value === 'null') return;

                    const row = document.createElement('tr');
                    const th = document.createElement('th');
                    th.textContent = rowData.key;
                    const td = document.createElement('td');

                    if (rowData.class) {
                        td.className = rowData.class;
                    }

                    td.innerHTML = `${rowData.prefix || ''} ${rowData.value}`;

                    row.appendChild(th);
                    row.appendChild(td);
                    table.appendChild(row);
                });

                content.innerHTML = '';
                content.appendChild(table);
            }

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

            function isValidIP(ip) {
                const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                return ipRegex.test(ip);
            }

            function isPublicIP(ip) {
                if (!isValidIP(ip)) return false;

                const parts = ip.split('.').map(Number);

                if (parts[0] === 10) return false;
                if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
                if (parts[0] === 192 && parts[1] === 168) return false;
                if (parts[0] === 127) return false;
                if (parts[0] === 169 && parts[1] === 254) return false;

                return true;
            }

            async function getLocationFromIPInfo(ip) {
                if (!CONFIG.apiKey || CONFIG.apiKey === "DEIN_API_KEY_HIER") return null;

                try {
                    const response = await fetch(`https://ipinfo.io/${ip}?token=${CONFIG.apiKey}`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
                    });

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const json = await response.json();

                    return {
                        ...json,
                        country: getCountryName(json.country),
                        country_code: json.country,
                        source: 'IPInfo.io'
                    };
                } catch (error) {
                    return null;
                }
            }

            async function getLocationFromIPAPI(ip) {
                try {
                    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query,proxy,mobile`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
                    });

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const json = await response.json();

                    if (json.status === 'fail') throw new Error(json.message);

                    return {
                        ip: json.query,
                        country: json.country,
                        country_code: json.countryCode,
                        region: json.regionName,
                        city: json.city,
                        zip: json.zip,
                        lat: json.lat,
                        lon: json.lon,
                        timezone: json.timezone,
                        isp: json.isp,
                        org: json.org,
                        as: json.as,
                        proxy: json.proxy,
                        mobile: json.mobile,
                        source: 'IP-API.com'
                    };
                } catch (error) {
                    return null;
                }
            }

            async function getLocationFromIPGeolocation(ip) {
                if (!CONFIG.apiKey || CONFIG.apiKey === "DEIN_API_KEY_HIER") return null;

                try {
                    const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${CONFIG.apiKey}&ip=${ip}&fields=*`, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' },
                        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
                    });

                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const json = await response.json();

                    return {
                        ...json,
                        country: json.country_name,
                        country_code: json.country_code2,
                        region: json.state_prov,
                        zip: json.zipcode,
                        lat: json.latitude,
                        lon: json.longitude,
                        source: 'IPGeolocation.io'
                    };
                } catch (error) {
                    return null;
                }
            }

            async function getLocationData(ip) {
                if (!isPublicIP(ip)) {
                    updateStatus('error');
                    return;
                }

                updateStatus('loading');

                const cached = getCachedData(ip);
                if (cached) {
                    updatePanelContent(cached, true);
                    updateStatus('online');
                    return;
                }

                const promises = [
                    getLocationFromIPAPI(ip),
                    getLocationFromIPInfo(ip),
                    getLocationFromIPGeolocation(ip)
                ];

                try {
                    const results = await Promise.allSettled(promises);
                    let bestResult = null;

                    for (const result of results) {
                        if (result.status === 'fulfilled' && result.value) {
                            bestResult = result.value;
                            break;
                        }
                    }

                    if (bestResult) {
                        const verified = bestResult.ip === ip || bestResult.query === ip;
                        updatePanelContent(bestResult, verified);
                        setCachedData(ip, bestResult);
                        updateStatus('online');
                        retryCount = 0;
                    } else {
                        throw new Error('All APIs failed');
                    }

                } catch (error) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(() => getLocationData(ip), CONFIG.retryDelay * retryCount);
                    } else {
                        updateStatus('error');
                        const content = panel.querySelector('#tap-geo-content');
                        if (content) {
                            content.innerHTML = '<div style="padding: 20px; text-align: center; color: #e74c3c; font-weight: 600;">❌ Unable to fetch location data</div>';
                        }
                    }
                }
            }

            function setupWebRTCHook() {
                try {
                    const OriginalRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
                    if (!OriginalRTC) return;

                    const originalAddCandidate = OriginalRTC.prototype.addIceCandidate;
                    if (!originalAddCandidate) return;

                    OriginalRTC.prototype.addIceCandidate = function(candidate, ...args) {
                        setTimeout(() => {
                            try {
                                const candidateStr = candidate?.candidate || '';
                                const ipMatches = candidateStr.match(/(\d{1,3}(?:\.\d{1,3}){3})/g);
                                const typeMatch = candidateStr.match(/typ\s+(srflx|relay|host)/);

                                if (ipMatches && typeMatch) {
                                    for (const ip of ipMatches) {
                                        if (isPublicIP(ip) && !ipHistory.has(ip)) {
                                            ipHistory.add(ip);

                                            if (ip !== lastIp) {
                                                lastIp = ip;
                                                currentIp = ip;
                                                getLocationData(ip);
                                            }
                                        }
                                    }
                                }
                            } catch (e) {}
                        }, 0);

                        return originalAddCandidate.call(this, candidate, ...args);
                    };

                    OriginalRTC.prototype.addIceCandidate.toString = function() {
                        return 'function addIceCandidate() { [native code] }';
                    };

                } catch (error) {
                    console.error('[Geolocation] WebRTC hook failed:', error);
                }
            }

            let updateInterval = null;
            function startUpdates() {
                if (updateInterval) return;

                updateInterval = setInterval(() => {
                    const now = Date.now();
                    for (const [ip, data] of ipCache.entries()) {
                        if (now - data.timestamp > CONFIG.cacheTime * 2) {
                            ipCache.delete(ip);
                        }
                    }

                    if (ipHistory.size > 20) {
                        const oldestIps = Array.from(ipHistory).slice(0, 10);
                        oldestIps.forEach(ip => ipHistory.delete(ip));
                    }
                }, CONFIG.refreshInterval);
            }

            function cleanup() {
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
                ipCache.clear();
                ipHistory.clear();
            }

            function initialize() {
                injectStyles();
                createPanel();
                setupWebRTCHook();
                startUpdates();
                window.addEventListener('beforeunload', cleanup);
                console.log('[Geolocation Enhanced] Comprehensive IP tracking loaded');
            }

            initialize();

        } catch (error) {
            console.error('[Geolocation Enhanced] Initialization failed:', error);
        }
    }

})();
