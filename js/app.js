// app.js - Dashboard Logic and Firebase Data


// =========================
// DOM ELEMENTS
// =========================
const tempEl = document.getElementById("temp");
const phEl = document.getElementById("ph");
const salinityEl = document.getElementById("salinity");
const turbidityEl = document.getElementById("turbidity");
const doEl = document.getElementById("do");

const espEl = document.getElementById("espStatus");
const batteryEl = document.getElementById("battery");
const aeratorEl = document.getElementById("aeratorStatusText");
const lastUpdateEl = document.getElementById("lastUpdate");


// =========================
// CHECK DATABASE
// =========================
if (typeof window.database === 'undefined') {
  // Fallback: Use mock data for testing navigation
  useMockDataForNavigation();
} else {
}

// =========================
// MOCK DATA FOR NAVIGATION TESTING
// =========================
function useMockDataForNavigation() {
  
  const mockData = {
    temp: 28.5,
    ph: 7.2,
    salinity: 32.8,
    turbidity: 3.5,
    do: 6.8,
    battery: 85,
    aerator: "ON",
    lastUpdate: new Date().toLocaleTimeString()
  };
  
  // Update dashboard with mock data
  setTimeout(() => {
    if (tempEl) {
      tempEl.textContent = mockData.temp.toFixed(2);
      tempEl.className = "safe";
    }
    if (phEl) {
      phEl.textContent = mockData.ph.toFixed(2);
      phEl.className = "safe";
    }
    if (salinityEl) {
      salinityEl.textContent = mockData.salinity.toFixed(2);
      salinityEl.className = "safe";
    }
    if (turbidityEl) {
      turbidityEl.textContent = mockData.turbidity.toFixed(2);
      turbidityEl.className = "caution";
    }
    if (doEl) {
      doEl.textContent = mockData.do.toFixed(2);
      doEl.className = "safe";
    }
    if (batteryEl) {
      batteryEl.textContent = mockData.battery + "%";
      updateBatteryColor(mockData.battery);
    }
    if (aeratorEl) {
      aeratorEl.textContent = mockData.aerator;
      aeratorEl.style.color = mockData.aerator === "ON" ? "#22c55e" : "#ef4444";
    }
    if (lastUpdateEl) {
      lastUpdateEl.textContent = mockData.lastUpdate;
    }
    if (espEl) {
      espEl.classList.add("online");
      espEl.classList.remove("offline");
    }
  }, 500);
}

// =========================
// LOAD THRESHOLDS (GLOBAL)
// =========================
window.thresholds = null;
if (typeof window.database !== 'undefined') {
  window.database.ref("thresholds").on("value", snapshot => {
    window.thresholds = snapshot.val();
  });
}

// =========================
// SENSOR DATA
// =========================
if (typeof window.database !== 'undefined') {
  window.database.ref("sensors").on("value", snapshot => {
    const data = snapshot.val();

    if (!data) {
      return;
    }

    if (tempEl) {
      tempEl.textContent = data.temperature !== undefined ? data.temperature.toFixed(2) : "--";
      const statusClass = getStatusClass(data.temperature, window.thresholds?.temperature);
      tempEl.className = statusClass;
      setStatusText('tempStatus', statusClass);
    }

    if (phEl) {
      phEl.textContent = data.ph !== undefined ? data.ph.toFixed(2) : "--";
      const statusClass = getStatusClass(data.ph, window.thresholds?.ph);
      phEl.className = statusClass;
      setStatusText('phStatus', statusClass);
    }

    if (salinityEl) {
      salinityEl.textContent = data.salinity !== undefined ? data.salinity.toFixed(2) : "--";
      const statusClass = getStatusClass(data.salinity, window.thresholds?.salinity);
      salinityEl.className = statusClass;
      setStatusText('salinityStatus', statusClass);
    }

    if (turbidityEl) {
      turbidityEl.textContent = data.turbidity !== undefined ? data.turbidity.toFixed(2) : "--";
      const statusClass = getStatusClass(data.turbidity, window.thresholds?.turbidity);
      turbidityEl.className = statusClass;
      setStatusText('turbidityStatus', statusClass);
    }

    if (doEl) {
      doEl.textContent = data.do !== undefined ? data.do.toFixed(2) : "--";
      const statusClass = getStatusClass(data.do, window.thresholds?.do);
      doEl.className = statusClass;
      setStatusText('doStatus', statusClass);
    }

    // Update last update time from sensor data
    if (lastUpdateEl && data.lastUpdate) {
      const date = new Date(data.lastUpdate);
      lastUpdateEl.textContent = date.toLocaleString();
    } else if (lastUpdateEl) {
      lastUpdateEl.textContent = new Date().toLocaleTimeString();
    }

    // Track lastUpdate for heartbeat check
    window._lastSensorUpdate = data.lastUpdate ? Number(data.lastUpdate) : Date.now();

    // Check thresholds and show toast notifications
    checkThresholdsAndToast(data);
  });
}

// =========================
// SYSTEM STATUS (battery, aerator, esp32Online from /system)
// =========================
if (typeof window.database !== 'undefined') {
  window.database.ref("system").on("value", snapshot => {
    const system = snapshot.val();

    if (!system) {
      return;
    }

    // Battery percentage
    try {
      if (batteryEl && system.battery !== undefined) {
        updateBatteryColor(Number(system.battery));
      }
    } catch (e) {}

    // Aerator status
    try {
      const aeratorLive = document.getElementById("aeratorStatusText");
      if (aeratorLive) {
        const isOn = !!system.aerator;
        aeratorLive.textContent = isOn ? "ON" : "OFF";
        aeratorLive.style.color = isOn ? "#22c55e" : "#ef4444";
      }
    } catch (e) {}

    // esp32Online flag from /system (immediate flag set by device)
    if (espEl) {
      if (system.esp32Online) {
        espEl.classList.add("online");
        espEl.classList.remove("offline");
      } else {
        espEl.classList.add("offline");
        espEl.classList.remove("online");
      }
    }
  });
}

// =========================
// ESP32 HEARTBEAT CHECK
// Verifies every 60 seconds that /sensors.lastUpdate
// has been updated within the last 60 seconds.
// If not → mark ESP32 offline on the dashboard.
// =========================
window._lastSensorUpdate = null;

function checkEsp32Heartbeat() {
  if (window._lastSensorUpdate === null) {
    // No data received yet — mark offline
    if (espEl) {
      espEl.classList.add("offline");
      espEl.classList.remove("online");
    }
    return;
  }

  const now     = Date.now();
  const elapsed = now - window._lastSensorUpdate;   // ms
  const isAlive = elapsed <= 60000;                  // within 1 minute


  if (espEl) {
    if (isAlive) {
      espEl.classList.add("online");
      espEl.classList.remove("offline");
    } else {
      espEl.classList.add("offline");
      espEl.classList.remove("online");
    }
  }
}

// Run every 60 seconds
setInterval(checkEsp32Heartbeat, 60000);

// =========================
// AERATOR DOM-READY REAPPLY
// If the system listener fired before the DOM was fully painted,
// re-read /system once on DOMContentLoaded to guarantee the aerator shows.
// =========================
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.database === 'undefined') return;
  window.database.ref("system").once("value", snapshot => {
    const system = snapshot.val();
    if (!system) return;

    const aeratorLive = document.getElementById("aeratorStatusText");
    if (aeratorLive) {
      const isOn = !!system.aerator;
      aeratorLive.textContent = isOn ? "ON" : "OFF";
      aeratorLive.style.color = isOn ? "#22c55e" : "#ef4444";
    }

    const batteryLive = document.getElementById("battery");
    if (batteryLive && system.battery !== undefined) {
      if (typeof updateBatteryColor === 'function') updateBatteryColor(Number(system.battery));
    }

    const espLive = document.getElementById("espStatus");
    if (espLive) {
      if (system.esp32Online) {
        espLive.classList.add("online");
        espLive.classList.remove("offline");
      } else {
        espLive.classList.add("offline");
        espLive.classList.remove("online");
      }
    }
  });
});

// =========================
// HELPER FUNCTION
// =========================
function getStatusClass(value, threshold) {
  if (!threshold || value === undefined) return "unknown";

  // CRITICAL: outside alert range
  if (value < threshold.alertMin || value > threshold.alertMax) {
    return "critical";
  }

  // ALERT: between alert and safe range
  if (value < threshold.safeMin || value > threshold.safeMax) {
    return "caution";
  }

  // SAFE
  return "safe";
}

// Set the status text below a metric card
function setStatusText(elementId, statusClass) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const mapping = { safe: 'Safe', caution: 'Warning', critical: 'Critical', unknown: '--' };
  el.textContent = mapping[statusClass] || '--';
  // Update class for color styling; apply fixed width pill by default
  el.className = 'status-text ' + (statusClass || 'unknown') + ' fixed';
}

// =========================
// BATTERY COLOR UPDATE
// =========================
function updateBatteryColor(percentage) {
  const batteryIndicator = document.getElementById('batteryIndicator');
  if (!batteryIndicator) return;

  const batteryIcon = batteryIndicator.querySelector('i');
  const batteryText = document.getElementById('battery');

  const pct = Math.min(100, Math.max(0, Number(percentage)));
  const isLow = pct <= 20;

  // Toggle low class on indicator
  batteryIndicator.classList.toggle('low', isLow);

  // Update icon to always be full
  if (batteryIcon) {
    batteryIcon.className = 'fas fa-battery-full';
  }

  // Update percentage text with color coding
  if (batteryText) {
    batteryText.textContent = pct.toFixed(0) + '%';
    // Green (safe) > 50%, Yellow (caution) 20-50%, Red (critical) ≤ 20%
    if (pct > 50) {
      batteryText.style.color = '#22c55e'; // Green
    } else if (pct > 20) {
      batteryText.style.color = '#f59e0b'; // Yellow
    } else {
      batteryText.style.color = '#ef4444'; // Red
    }
  }
}

// =========================
// ROLE-BASED MENU VISIBILITY
// =========================
function hideMenuItemsForRole() {
  
  // Get current user session
  const userSession = localStorage.getItem('userSession');
  let isGuest = false;
  let isAdmin = false;
  
  if (userSession) {
    try {
      const session = JSON.parse(userSession);
      isGuest = session.isGuest === true;
      isAdmin = session.role === 'admin';
    } catch (error) {
    }
  }
  
  // Menu items to hide for guests
  const guestHideItems = [
    'historyTab',      // Monitor
    'alertsTab',       // Alerts
    'reportsTab',      // Reports
    'userSystemTab'    // User & System
  ];
  
  // Hide restricted items for guests
  if (isGuest) {
    guestHideItems.forEach(itemId => {
      const element = document.getElementById(itemId);
      if (element) {
        element.style.display = 'none';
      }
    });
    // Hide admin dashboard for guests
    const adminDashboard = document.getElementById('adminDashboardTab');
    if (adminDashboard) {
      adminDashboard.style.display = 'none';
    }
  } else {
    guestHideItems.forEach(itemId => {
      const element = document.getElementById(itemId);
      if (element) {
        element.style.display = '';
      }
    });
  }
  
  // Show admin dashboard only for admins
  const adminDashboardTab = document.getElementById('adminDashboardTab');
  if (adminDashboardTab) {
    if (isAdmin) {
      adminDashboardTab.style.display = '';
    } else {
      adminDashboardTab.style.display = 'none';
    }
  }
}

// =========================
// TOAST NOTIFICATION SYSTEM
// =========================

// Inject toast styles once into the page
(function injectToastStyles() {
  if (document.getElementById('threshold-toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'threshold-toast-styles';
  style.textContent = `
    #threshold-toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: calc(100vw - 40px);
    }
    .threshold-toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 10px;
      width: 340px;
      max-width: 100%;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
      font-family: Inter, sans-serif;
      font-size: 13.5px;
      color: #f1f5f9;
      pointer-events: all;
      animation: toastSlideIn 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
      background: #1e293b;
      border-left: 4px solid #e74c3c;
      box-sizing: border-box;
    }
    /* ── Small phones (≤ 480px) ── */
    @media (max-width: 480px) {
      #threshold-toast-container {
        top: 12px;
        right: 12px;
        max-width: calc(100vw - 24px);
      }
      .threshold-toast {
        width: calc(100vw - 24px);
        font-size: 12px;
        padding: 10px 12px;
        gap: 9px;
        border-radius: 8px;
      }
      .toast-title { font-size: 12px; }
      .toast-detail { font-size: 11.5px; }
      .toast-icon { font-size: 16px; }
      .toast-close { font-size: 13px; }
    }

    /* ── Large phones (481px – 768px) ── */
    @media (min-width: 481px) and (max-width: 768px) {
      #threshold-toast-container {
        top: 16px;
        right: 16px;
        max-width: calc(100vw - 32px);
      }
      .threshold-toast {
        width: 320px;
        font-size: 13px;
        padding: 12px 14px;
      }
      .toast-icon { font-size: 18px; }
    }

    /* ── Tablets (769px – 1024px) ── */
    @media (min-width: 769px) and (max-width: 1024px) {
      #threshold-toast-container {
        top: 18px;
        right: 18px;
      }
      .threshold-toast {
        width: 340px;
        font-size: 13.5px;
      }
    }

    /* ── Desktop & TV (1025px+) — default styles apply, no override needed ── */
    /* ── Large TV / 4K (1920px+) ── */
    @media (min-width: 1920px) {
      #threshold-toast-container {
        top: 32px;
        right: 32px;
        gap: 14px;
      }
      .threshold-toast {
        width: 420px;
        font-size: 15px;
        padding: 18px 20px;
        gap: 16px;
        border-radius: 12px;
        border-left-width: 5px;
      }
      .toast-title { font-size: 15px; }
      .toast-detail { font-size: 14px; }
      .toast-icon { font-size: 24px; }
      .toast-close { font-size: 18px; }
    }
    .threshold-toast.warning  { border-left-color: #f39c12; }
    .threshold-toast.critical { border-left-color: #e74c3c; }
    .threshold-toast.toast-exit {
      animation: toastSlideOut 0.35s ease forwards;
    }
    .toast-icon {
      font-size: 20px;
      line-height: 1;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .toast-icon.warning  { color: #f39c12; }
    .toast-icon.critical { color: #e74c3c; }
    .toast-body { flex: 1; line-height: 1.45; }
    .toast-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 3px;
      letter-spacing: 0.01em;
    }
    .toast-title.critical { color: #fca5a5; }
    .toast-title.warning  { color: #fcd34d; }
    .toast-detail { opacity: 0.85; font-size: 12.5px; }
    .toast-close {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 15px;
      padding: 0;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
      transition: color 0.15s;
    }
    .toast-close:hover { color: #f1f5f9; }
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(110%); }
      to   { opacity: 1; transform: translateX(0);    }
    }
    @keyframes toastSlideOut {
      from { opacity: 1; transform: translateX(0);    max-height: 120px; }
      to   { opacity: 0; transform: translateX(110%); max-height: 0;     }
    }
  `;
  document.head.appendChild(style);
})();

// Ensure the toast container exists
function getToastContainer() {
  let container = document.getElementById('threshold-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'threshold-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// Track active toasts per parameter (used to replace on severity change)
window._activeToastParams = window._activeToastParams || {};

// Parameter display config
const TOAST_PARAM_CONFIG = {
  temperature: { label: 'Temperature',      unit: '°C'    },
  ph:          { label: 'pH Level',         unit: ''      },
  salinity:    { label: 'Salinity',         unit: ' ppt'  },
  turbidity:   { label: 'Turbidity',        unit: ' NTU'  },
  do:          { label: 'Dissolved Oxygen', unit: ' mg/L' }
};

// ── SESSION SUPPRESSION HELPERS ──────────────────────────────────────────────
// Stores param:severity pairs in sessionStorage so navigation doesn't re-trigger
// the same toast. Cleared automatically when value returns to safe.

function _getSuppressed() {
  try {
    return JSON.parse(sessionStorage.getItem('_toastSuppressed') || '{}');
  } catch (_) { return {}; }
}

function _isSuppressed(param, severity) {
  return _getSuppressed()[param] === severity;
}

function _suppress(param, severity) {
  const map = _getSuppressed();
  map[param] = severity;
  sessionStorage.setItem('_toastSuppressed', JSON.stringify(map));
}

function _clearSuppression(param) {
  const map = _getSuppressed();
  if (map[param]) {
    delete map[param];
    sessionStorage.setItem('_toastSuppressed', JSON.stringify(map));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show a slide-in toast for a threshold breach.
 * One toast per parameter at a time — refreshed if severity changes.
 * Suppressed across page navigation via sessionStorage.
 */
function showThresholdToast(param, value, severity) {
  const config  = TOAST_PARAM_CONFIG[param] || { label: param, unit: '' };
  const toastId = `toast-param-${param}`;
  const existing = document.getElementById(toastId);

  // Already shown and suppressed for this severity (survives page navigation)
  if (_isSuppressed(param, severity)) return;

  // If same severity toast is already visible in DOM, skip
  if (existing && existing.dataset.severity === severity) return;

  // Severity changed — remove old one instantly before adding new
  if (existing) dismissToast(toastId, true);

  const isCritical = severity === 'critical';
  const titleText  = isCritical ? 'Critical Alert' : 'Warning Alert';
  const displayVal = typeof value === 'number' ? value.toFixed(2) : value;
  const detailText = `${config.label} is ${displayVal}${config.unit} — ${
    isCritical ? 'outside critical range' : 'outside safe range'
  }`;

  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `threshold-toast ${severity}`;
  toast.dataset.severity = severity;
  toast.innerHTML = `
    <i class="fas fa-exclamation-triangle toast-icon ${severity}"></i>
    <div class="toast-body">
      <div class="toast-title ${severity}">${titleText}</div>
      <div class="toast-detail">${detailText}</div>
    </div>
    <button class="toast-close" onclick="dismissToast('${toastId}')" title="Dismiss">✕</button>
  `;

  getToastContainer().appendChild(toast);
  window._activeToastParams[param] = toastId;

  // Auto-dismiss after 5 seconds and suppress so navigation won't re-show it
  setTimeout(() => {
    dismissToast(toastId);
    _suppress(param, severity);
  }, 5000);
}

/**
 * Dismiss a toast by ID with slide-out animation.
 * Suppresses the param+severity so navigating away won't re-trigger it.
 * @param {string}  id      - Toast element ID
 * @param {boolean} instant - Skip animation (used when replacing on severity change)
 */
function dismissToast(id, instant = false) {
  const toast = document.getElementById(id);
  if (!toast) return;

  // Suppress this param+severity when manually closed or auto-dismissed
  const param    = id.replace('toast-param-', '');
  const severity = toast.dataset.severity;
  if (param && severity) _suppress(param, severity);

  if (instant) {
    toast.remove();
    return;
  }

  toast.classList.add('toast-exit');
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 380);
}

/**
 * Called on every sensor data update.
 * Checks all parameters and shows/clears toasts accordingly.
 */
function checkThresholdsAndToast(sensorData) {
  if (!sensorData || !window.thresholds) return;

  const params = ['temperature', 'ph', 'salinity', 'turbidity', 'do'];

  params.forEach(param => {
    const value     = sensorData[param];
    const threshold = window.thresholds[param];
    if (value === undefined || value === null || !threshold) return;

    const status = getStatusClass(value, threshold);

    if (status === 'critical' || status === 'caution') {
      // Map internal 'caution' → display 'warning'
      showThresholdToast(param, value, status === 'caution' ? 'warning' : 'critical');
    } else {
      // Value returned to safe — clear toast and reset suppression for this param
      const toastId = `toast-param-${param}`;
      if (document.getElementById(toastId)) {
        dismissToast(toastId);
      }
      _clearSuppression(param);
      delete window._activeToastParams[param];
    }
  });
}

// =========================
// DOM READY
// =========================
document.addEventListener("DOMContentLoaded", () => {

  // Hide menu items based on role
  hideMenuItemsForRole();

  // Add card click handlers for visual feedback
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.onclick = null;
    
    card.addEventListener('click', function(e) {
      this.style.transform = 'scale(0.98)';
      setTimeout(() => {
        this.style.transform = '';
      }, 150);
    });
  });

});