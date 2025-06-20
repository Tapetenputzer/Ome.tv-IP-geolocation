// ==UserScript==
// @name         made by taptenputzer (v1.2)
// @namespace    https://github.com/Tapetenputzer/Ome.tv-IP-geolocation
// @version      1.2
// @description  Ome.tv IP Geolocation – srflx only, Panel-Ausgabe, kein Chat-Spam
// @author       taptenputzer
// @match        https://ome.tv/
// @icon         https://www.google.com/s2/favicons?domain=ome.tv
// @license      MIT License
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 1) Panel-Styling
    const style = document.createElement('style');
    style.textContent = `
    #tap-geo-panel {
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 300px;
        max-height: 50%;
        overflow-y: auto;
        background: rgba(255,255,255,0.95);
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 99999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    #tap-geo-panel table {
        width: 100%;
        border-collapse: collapse;
    }
    #tap-geo-panel th {
        text-align: left;
        padding: 4px;
        font-weight: bold;
        color: #333;
        width: 45%;
    }
    #tap-geo-panel td {
        padding: 4px;
        color: #000;
    }
    #tap-geo-panel h4 {
        margin: 4px 0 8px;
        font-size: 14px;
        text-align: center;
        color: #111;
    }
    `;
    document.documentElement.appendChild(style);

    // 2) Panel erzeugen
    const panel = document.createElement('div');
    panel.id = 'tap-geo-panel';
    panel.innerHTML = '<h4>IP-Geolocation</h4>';
    document.body.appendChild(panel);

    // 3) WebRTC–Hook
    const OriginalPC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    let lastIp = null;
    let currentIp = null;
    if (OriginalPC) {
        const origAdd = OriginalPC.prototype.addIceCandidate;
        Object.defineProperty(OriginalPC.prototype, 'addIceCandidate', {
            value: function(ice, ...rest) {
                try {
                    const cand = ice.candidate || '';
                    const typeMatch = cand.match(/typ\s(srflx)/);
                    const ipMatch  = cand.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/);
                    if (typeMatch && ipMatch) {
                        const ip = ipMatch[1];
                        if (ip !== lastIp) {
                            lastIp = ip;
                            currentIp = ip;
                            getLocation(ip);
                        }
                    }
                } catch (_){}
                return origAdd.call(this, ice, ...rest);
            },
            writable: true,
            configurable: true
        });
        OriginalPC.prototype.addIceCandidate.toString = () => 'function addIceCandidate() { [native code] }';
    }

    // 4) Geolocation via API (nur Panel)
    const apiKey = "2f1708b3bb82a3"; // Ersetze mit deinem funktionierenden Key
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

    function addPanelEntry(dataObj) {
        panel.innerHTML = '<h4>IP-Geolocation</h4>';
        const table = document.createElement('table');
        for (const [key, val] of Object.entries(dataObj)) {
            const row = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = key;
            const td = document.createElement('td');
            td.textContent = val;
            row.appendChild(th);
            row.appendChild(td);
            table.appendChild(row);
        }
        panel.appendChild(table);
    }

    async function getLocation(ip) {
        try {
            const res  = await fetch(`https://ipinfo.io/${ip}?token=${apiKey}`);
            const json = await res.json();
            const data = {
                "IP":       json.ip,
                "Country":  regionNames.of(json.country),
                "State":    json.region,
                "City":     json.city,
                "Lat/Long": json.loc
            };
            addPanelEntry(data);
        } catch (e) {
            console.error('[taptenputzer] Geolocation error:', e);
        }
    }

    // 5) Panel-Refresh
    setInterval(() => {
        if (currentIp) getLocation(currentIp);
    }, 1000);

    // 6) Neustart-Knopf ausblenden
    function hideRestartButtons() {
        ['button','a','div','span'].forEach(tag => {
            document.querySelectorAll(tag).forEach(el => {
                if (el.innerText && el.innerText.trim().toLowerCase() === 'neustart') {
                    el.style.display = 'none';
                }
            });
        });
    }
    document.addEventListener('DOMContentLoaded', hideRestartButtons);
    new MutationObserver(hideRestartButtons).observe(document.documentElement, { childList: true, subtree: true });

})();
