/* =========================================================
   WeatherVue — App Logic v2
   Fixed bugs + particles, typewriter AI, number counters
   ========================================================= */

const GEMINI_API_KEY = 'AIzaSyB6BdIGDJLQWW-DLuctAeyDUAb6lVQ_-0';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const OPEN_METEO_WEATHER = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEO = 'https://geocoding-api.open-meteo.com/v1/search';

// --- Weather Code Mapping ---
const WMO_CODES = {
    0:  { label: 'Clear Sky', emoji: '☀️', night: '🌙', particles: 'stars' },
    1:  { label: 'Mostly Clear', emoji: '🌤️', night: '🌙', particles: 'stars' },
    2:  { label: 'Partly Cloudy', emoji: '⛅', night: '☁️', particles: 'none' },
    3:  { label: 'Overcast', emoji: '☁️', night: '☁️', particles: 'none' },
    45: { label: 'Foggy', emoji: '🌫️', night: '🌫️', particles: 'fog' },
    48: { label: 'Rime Fog', emoji: '🌫️', night: '🌫️', particles: 'fog' },
    51: { label: 'Light Drizzle', emoji: '🌦️', night: '🌧️', particles: 'rain-light' },
    53: { label: 'Drizzle', emoji: '🌦️', night: '🌧️', particles: 'rain-light' },
    55: { label: 'Heavy Drizzle', emoji: '🌧️', night: '🌧️', particles: 'rain' },
    56: { label: 'Freezing Drizzle', emoji: '🌧️', night: '🌧️', particles: 'rain' },
    57: { label: 'Heavy Freezing Drizzle', emoji: '🌧️', night: '🌧️', particles: 'rain' },
    61: { label: 'Light Rain', emoji: '🌦️', night: '🌧️', particles: 'rain-light' },
    63: { label: 'Rain', emoji: '🌧️', night: '🌧️', particles: 'rain' },
    65: { label: 'Heavy Rain', emoji: '🌧️', night: '🌧️', particles: 'rain-heavy' },
    66: { label: 'Freezing Rain', emoji: '🌧️', night: '🌧️', particles: 'rain' },
    67: { label: 'Heavy Freezing Rain', emoji: '🌧️', night: '🌧️', particles: 'rain-heavy' },
    71: { label: 'Light Snow', emoji: '🌨️', night: '🌨️', particles: 'snow-light' },
    73: { label: 'Snow', emoji: '❄️', night: '❄️', particles: 'snow' },
    75: { label: 'Heavy Snow', emoji: '❄️', night: '❄️', particles: 'snow-heavy' },
    77: { label: 'Snow Grains', emoji: '❄️', night: '❄️', particles: 'snow-light' },
    80: { label: 'Light Showers', emoji: '🌦️', night: '🌧️', particles: 'rain-light' },
    81: { label: 'Showers', emoji: '🌧️', night: '🌧️', particles: 'rain' },
    82: { label: 'Heavy Showers', emoji: '⛈️', night: '⛈️', particles: 'rain-heavy' },
    85: { label: 'Light Snow Showers', emoji: '🌨️', night: '🌨️', particles: 'snow-light' },
    86: { label: 'Heavy Snow Showers', emoji: '❄️', night: '❄️', particles: 'snow-heavy' },
    95: { label: 'Thunderstorm', emoji: '⛈️', night: '⛈️', particles: 'rain-heavy' },
    96: { label: 'Thunderstorm + Hail', emoji: '⛈️', night: '⛈️', particles: 'rain-heavy' },
    99: { label: 'Thunderstorm + Heavy Hail', emoji: '⛈️', night: '⛈️', particles: 'rain-heavy' },
};

// --- DOM Elements ---
const $ = (id) => document.getElementById(id);
const searchInput = $('search-input');
const suggestionsEl = $('search-suggestions');
const geoBtn = $('geo-btn');
const loadingOverlay = $('loading-overlay');
const mainContent = $('main-content');

// --- State ---
let currentCity = { name: 'New Delhi', country: 'India', lat: 28.6139, lon: 77.2090 };
let currentWeatherData = null;
let searchTimeout = null;
let particleAnimId = null;

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupScrollAnimations();
    loadWeather(currentCity.lat, currentCity.lon, currentCity.name, currentCity.country);
});

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', () => {
        if (suggestionsEl.children.length > 0) suggestionsEl.classList.add('active');
    });
    document.addEventListener('click', (e) => {
        if (!$('search-container').contains(e.target)) suggestionsEl.classList.remove('active');
    });

    // Geolocation
    geoBtn.addEventListener('click', handleGeolocation);

    // AI Refresh
    $('ai-refresh-btn').addEventListener('click', fetchAIInsights);

    // Keyboard navigation for search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const first = suggestionsEl.querySelector('.suggestion-item');
            if (first) first.click();
        }
        if (e.key === 'Escape') {
            suggestionsEl.classList.remove('active');
            searchInput.blur();
        }
    });
}

// ===================== SCROLL ANIMATIONS =====================
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, i * 80);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    // Observe existing elements
    document.querySelectorAll('.animate-on-load').forEach(el => observer.observe(el));

    // Store observer for re-use
    window._scrollObserver = observer;
}

function triggerAnimations() {
    // Re-observe after content change
    document.querySelectorAll('.animate-on-load').forEach(el => {
        el.classList.remove('visible');
        if (window._scrollObserver) window._scrollObserver.observe(el);
    });
    // Trigger visible for items in viewport
    setTimeout(() => {
        document.querySelectorAll('.animate-on-load').forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                setTimeout(() => el.classList.add('visible'), i * 100);
            }
        });
    }, 50);
}

// ===================== SEARCH / GEOCODING =====================
function handleSearchInput(e) {
    const query = e.target.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    if (query.length < 2) {
        suggestionsEl.classList.remove('active');
        suggestionsEl.innerHTML = '';
        return;
    }
    searchTimeout = setTimeout(() => searchCities(query), 350);
}

async function searchCities(query) {
    try {
        const res = await fetch(`${OPEN_METEO_GEO}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const data = await res.json();
        if (!data.results || data.results.length === 0) {
            suggestionsEl.innerHTML = '<div class="suggestion-item" style="color:var(--text-tertiary);cursor:default">No results found</div>';
            suggestionsEl.classList.add('active');
            return;
        }
        suggestionsEl.innerHTML = data.results.map(r => `
            <div class="suggestion-item" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}" data-country="${r.country || ''}">
                <span class="city-name">📍 ${r.name}</span>
                <span class="country-name">${r.admin1 ? r.admin1 + ', ' : ''}${r.country || ''}</span>
            </div>
        `).join('');
        suggestionsEl.querySelectorAll('.suggestion-item[data-lat]').forEach(item => {
            item.addEventListener('click', () => {
                const { lat, lon, name, country } = item.dataset;
                searchInput.value = name;
                suggestionsEl.classList.remove('active');
                loadWeather(parseFloat(lat), parseFloat(lon), name, country);
            });
        });
        suggestionsEl.classList.add('active');
    } catch (err) {
        console.error('Geocoding error:', err);
        showError('Search failed. Check your internet connection.');
    }
}

// ===================== GEOLOCATION =====================
function handleGeolocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
    }
    geoBtn.classList.add('locating');
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude: lat, longitude: lon } = pos.coords;
            // Use forward geocoding with coordinates for a nearby city name
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
                const data = await res.json();
                const name = data.address?.city || data.address?.town || data.address?.village || data.address?.state || 'Your Location';
                const country = data.address?.country || '';
                loadWeather(lat, lon, name, country);
                showSuccess(`Located: ${name}`);
            } catch {
                loadWeather(lat, lon, 'Your Location', '');
            }
            geoBtn.classList.remove('locating');
        },
        (err) => {
            showError('Location access was denied. Please allow location permissions.');
            geoBtn.classList.remove('locating');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// ===================== LOAD WEATHER =====================
async function loadWeather(lat, lon, cityName, country) {
    showLoading(true);
    currentCity = { name: cityName, country, lat, lon };

    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,uv_index,is_day,dew_point_2m',
        hourly: 'temperature_2m,weather_code,is_day,visibility',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,apparent_temperature_max',
        timezone: 'auto',
        forecast_days: 7,
    });

    try {
        const res = await fetch(`${OPEN_METEO_WEATHER}?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        currentWeatherData = data;
        renderWeather(data);
        showLoading(false);
    } catch (err) {
        console.error('Weather fetch error:', err);
        showError('Failed to fetch weather data. Please try again.');
        showLoading(false);
    }
}

// ===================== RENDER WEATHER =====================
function renderWeather(data) {
    const c = data.current;
    const d = data.daily;
    const h = data.hourly;
    const isDay = c.is_day === 1;
    const wmo = WMO_CODES[c.weather_code] || WMO_CODES[0];

    // --- Current ---
    $('current-location').textContent = `📍 ${currentCity.name}${currentCity.country ? ', ' + currentCity.country : ''}`;
    $('current-date').textContent = formatDate(new Date());
    $('current-condition').textContent = wmo.label;
    $('weather-emoji').textContent = isDay ? wmo.emoji : wmo.night;

    // Animated number counters
    animateNumber($('current-temp'), Math.round(c.temperature_2m), 800);
    animateNumber($('feels-like'), Math.round(c.apparent_temperature), 600);
    $('humidity').textContent = c.relative_humidity_2m;
    $('wind-speed').textContent = Math.round(c.wind_speed_10m);
    $('current-high').textContent = `H: ${Math.round(d.temperature_2m_max[0])}°`;
    $('current-low').textContent = `L: ${Math.round(d.temperature_2m_min[0])}°`;

    // --- Details ---
    const uvVal = c.uv_index != null ? c.uv_index : 0;
    $('uv-index').textContent = uvVal.toFixed(1);
    const uvPercent = Math.min((uvVal / 11) * 100, 100);
    setTimeout(() => { $('uv-bar').style.width = uvPercent + '%'; }, 300);
    $('uv-label').textContent = getUVLabel(uvVal);
    $('pressure').textContent = Math.round(c.surface_pressure);

    // Real visibility from hourly data (current hour)
    const currentHourIdx = findCurrentHourIndex(h.time);
    const visKm = h.visibility && h.visibility[currentHourIdx] != null
        ? (h.visibility[currentHourIdx] / 1000).toFixed(1)
        : '10+';
    $('visibility').textContent = visKm;

    // Real dew point from API
    $('dew-point').textContent = c.dew_point_2m != null ? Math.round(c.dew_point_2m) : '—';

    $('sunrise').textContent = formatTime(d.sunrise[0]);
    $('sunset').textContent = formatTime(d.sunset[0]);

    // --- Hourly ---
    renderHourly(h);

    // --- Daily ---
    renderDaily(d);

    // --- Dynamic Background & Particles ---
    updateBackground(c.weather_code, isDay);
    startParticles(wmo.particles, isDay);

    // --- Update icon glow color based on weather ---
    updateIconGlow(c.weather_code, isDay);

    // --- Show Content ---
    mainContent.style.display = 'block';
    triggerAnimations();

    // Reset AI content
    $('ai-content').innerHTML = `
        <div class="ai-placeholder">
            <div class="ai-sparkle">✨</div>
            <p>Click refresh to get AI-powered weather insights</p>
        </div>`;
}

function renderHourly(h) {
    const startIdx = findCurrentHourIndex(h.time);
    const hours = [];
    for (let i = startIdx; i < Math.min(startIdx + 24, h.time.length); i++) {
        const time = new Date(h.time[i]);
        const wmo = WMO_CODES[h.weather_code[i]] || WMO_CODES[0];
        const hourIsDay = h.is_day[i] === 1;
        const delay = (i - startIdx) * 0.04;
        hours.push(`
            <div class="hourly-item${i === startIdx ? ' now' : ''}" style="animation-delay:${delay}s">
                <div class="hourly-time">${i === startIdx ? 'Now' : formatHour(time)}</div>
                <span class="hourly-emoji">${hourIsDay ? wmo.emoji : wmo.night}</span>
                <div class="hourly-temp">${Math.round(h.temperature_2m[i])}°</div>
            </div>
        `);
    }
    $('hourly-scroll').innerHTML = hours.join('');
}

function renderDaily(d) {
    const count = Math.min(5, d.time.length);
    const allMin = Math.min(...d.temperature_2m_min.slice(0, count));
    const allMax = Math.max(...d.temperature_2m_max.slice(0, count));
    const range = allMax - allMin || 1;

    const days = [];
    for (let i = 0; i < count; i++) {
        const date = new Date(d.time[i] + 'T00:00');
        const wmo = WMO_CODES[d.weather_code[i]] || WMO_CODES[0];
        const lo = d.temperature_2m_min[i];
        const hi = d.temperature_2m_max[i];
        const left = ((lo - allMin) / range) * 100;
        const width = ((hi - lo) / range) * 100;
        const delay = i * 0.08;

        days.push(`
            <div class="daily-item" style="animation-delay:${delay}s">
                <span class="daily-day">${i === 0 ? 'Today' : formatDay(date)}</span>
                <span class="daily-emoji">${wmo.emoji}</span>
                <div class="daily-bar-container">
                    <div class="daily-bar">
                        <div class="daily-bar-fill" style="left:${left}%;width:${Math.max(width, 5)}%"></div>
                    </div>
                </div>
                <span class="daily-high">${Math.round(hi)}°</span>
                <span class="daily-low">${Math.round(lo)}°</span>
            </div>
        `);
    }
    $('daily-list').innerHTML = days.join('');
}

// ===================== ANIMATED NUMBER COUNTER =====================
function animateNumber(el, target, duration = 600) {
    const start = parseInt(el.textContent) || 0;
    if (start === target) { el.textContent = target; return; }
    const startTime = performance.now();
    const diff = target - start;

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + diff * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ===================== ICON GLOW COLOR =====================
function updateIconGlow(code, isDay) {
    const glow = document.querySelector('.icon-glow');
    if (!glow) return;
    if (!isDay) {
        glow.style.background = 'rgba(100, 120, 200, 0.6)';
    } else if (code === 0 || code === 1) {
        glow.style.background = 'rgba(255, 200, 50, 0.5)';
    } else if (code >= 51 && code <= 67) {
        glow.style.background = 'rgba(56, 189, 248, 0.4)';
    } else if (code >= 71 && code <= 86) {
        glow.style.background = 'rgba(200, 220, 255, 0.4)';
    } else if (code >= 95) {
        glow.style.background = 'rgba(140, 80, 255, 0.4)';
    } else {
        glow.style.background = 'rgba(108, 99, 255, 0.4)';
    }
}

// ===================== WEATHER PARTICLES SYSTEM =====================
function startParticles(type, isDay) {
    if (particleAnimId) cancelAnimationFrame(particleAnimId);

    const canvas = $('weather-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let particles = [];

    if (type === 'none' || !type) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Create particles based on type
    const counts = {
        'stars': 60, 'rain-light': 80, 'rain': 150, 'rain-heavy': 250,
        'snow-light': 40, 'snow': 80, 'snow-heavy': 140, 'fog': 30
    };
    const count = counts[type] || 50;

    for (let i = 0; i < count; i++) {
        particles.push(createParticle(type, canvas));
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            updateParticle(p, type, canvas);
            drawParticle(ctx, p, type, isDay);
        });

        particleAnimId = requestAnimationFrame(animate);
    }
    animate();
}

function createParticle(type, canvas) {
    if (type.startsWith('rain')) {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            speed: 4 + Math.random() * 8,
            length: 10 + Math.random() * 20,
            opacity: 0.1 + Math.random() * 0.3,
        };
    }
    if (type.startsWith('snow')) {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            speed: 0.5 + Math.random() * 2,
            size: 2 + Math.random() * 4,
            opacity: 0.2 + Math.random() * 0.5,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.01 + Math.random() * 0.03,
        };
    }
    if (type === 'stars') {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: 0.5 + Math.random() * 2,
            opacity: 0.1 + Math.random() * 0.8,
            twinkleSpeed: 0.01 + Math.random() * 0.03,
            phase: Math.random() * Math.PI * 2,
        };
    }
    // fog
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 80 + Math.random() * 150,
        opacity: 0.02 + Math.random() * 0.04,
        speedX: 0.2 + Math.random() * 0.5,
    };
}

function updateParticle(p, type, canvas) {
    if (type.startsWith('rain')) {
        p.y += p.speed;
        p.x -= p.speed * 0.3;
        if (p.y > canvas.height) { p.y = -p.length; p.x = Math.random() * canvas.width * 1.3; }
    } else if (type.startsWith('snow')) {
        p.y += p.speed;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 0.8;
        if (p.y > canvas.height) { p.y = -p.size; p.x = Math.random() * canvas.width; }
    } else if (type === 'stars') {
        p.phase += p.twinkleSpeed;
        p.opacity = 0.2 + Math.abs(Math.sin(p.phase)) * 0.7;
    } else if (type === 'fog') {
        p.x += p.speedX;
        if (p.x > canvas.width + p.size) p.x = -p.size;
    }
}

function drawParticle(ctx, p, type, isDay) {
    if (type.startsWith('rain')) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.length * 0.3, p.y + p.length);
        ctx.strokeStyle = `rgba(150, 200, 255, ${p.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    } else if (type.startsWith('snow')) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 240, 255, ${p.opacity})`;
        ctx.fill();
    } else if (type === 'stars') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 240, ${p.opacity})`;
        ctx.fill();
    } else if (type === 'fog') {
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(200, 210, 230, ${p.opacity})`);
        gradient.addColorStop(1, `rgba(200, 210, 230, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }
}

// ===================== DYNAMIC BACKGROUND =====================
function updateBackground(code, isDay) {
    let gradient;
    if (!isDay) {
        gradient = 'linear-gradient(135deg, #0a0e1a 0%, #1a1040 50%, #0f1729 100%)';
    } else if (code === 0 || code === 1) {
        gradient = 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #0e2244 100%)';
    } else if (code === 2 || code === 3) {
        gradient = 'linear-gradient(135deg, #121620 0%, #2a2e3a 50%, #1a1e2a 100%)';
    } else if (code >= 45 && code <= 48) {
        gradient = 'linear-gradient(135deg, #111520 0%, #1e2430 50%, #151a24 100%)';
    } else if (code >= 51 && code <= 67) {
        gradient = 'linear-gradient(135deg, #0d1117 0%, #1a2332 50%, #0f1520 100%)';
    } else if (code >= 71 && code <= 86) {
        gradient = 'linear-gradient(135deg, #151a24 0%, #2c3340 50%, #1a2030 100%)';
    } else if (code >= 95) {
        gradient = 'linear-gradient(135deg, #0a0a14 0%, #1a1028 50%, #14101e 100%)';
    } else {
        gradient = 'linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0f1420 100%)';
    }
    document.body.style.background = gradient;
}

// ===================== AI INSIGHTS (GEMINI) =====================
async function fetchAIInsights() {
    if (!currentWeatherData) return;

    const btn = $('ai-refresh-btn');
    const content = $('ai-content');

    btn.classList.add('spinning');
    content.innerHTML = `
        <div class="ai-loading">
            <div class="loader-ring"></div>
            <span>Generating AI insights...</span>
        </div>`;

    const c = currentWeatherData.current;
    const d = currentWeatherData.daily;
    const wmo = WMO_CODES[c.weather_code] || WMO_CODES[0];

    const prompt = `You are a friendly weather assistant. Based on this weather data for ${currentCity.name}, ${currentCity.country}, provide a helpful summary with practical advice. Keep it concise (3-4 short paragraphs). Use a warm, conversational tone.

Current Weather:
- Temperature: ${Math.round(c.temperature_2m)}°C (Feels like ${Math.round(c.apparent_temperature)}°C)
- Condition: ${wmo.label}
- Humidity: ${c.relative_humidity_2m}%
- Wind: ${Math.round(c.wind_speed_10m)} km/h
- UV Index: ${c.uv_index}

Today's Forecast:
- High: ${Math.round(d.temperature_2m_max[0])}°C / Low: ${Math.round(d.temperature_2m_min[0])}°C
- Sunrise: ${formatTime(d.sunrise[0])} / Sunset: ${formatTime(d.sunset[0])}

Give weather summary, what to wear, outdoor activity suggestions, and any health/safety tips if relevant. Format with short paragraphs. Do not use markdown headers or asterisks, just plain text with bold words wrapped in <strong> tags for emphasis.`;

    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || `API error (${res.status})`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No insights available.';

        // Typewriter effect
        await typewriterEffect(content, text);
    } catch (err) {
        console.error('Gemini error:', err);
        content.innerHTML = `
            <p style="color:var(--danger)">⚠️ Could not generate insights: ${err.message}</p>
            <p style="color:var(--text-tertiary);font-size:0.85rem;">Make sure your Gemini API key is valid and has quota remaining.</p>`;
    } finally {
        btn.classList.remove('spinning');
    }
}

// ===================== TYPEWRITER EFFECT =====================
async function typewriterEffect(container, text) {
    // Clean up markdown **bold** to <strong>
    const cleanText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    const paragraphs = cleanText.split('\n').filter(line => line.trim());
    container.innerHTML = '';

    for (const para of paragraphs) {
        const p = document.createElement('p');
        container.appendChild(p);

        // For HTML tags, we need to handle them carefully
        const chars = [];
        let inTag = false;
        let tagBuffer = '';

        for (const char of para) {
            if (char === '<') { inTag = true; tagBuffer = '<'; continue; }
            if (inTag) {
                tagBuffer += char;
                if (char === '>') { inTag = false; chars.push(tagBuffer); tagBuffer = ''; }
                continue;
            }
            chars.push(char);
        }

        let html = '';
        for (let i = 0; i < chars.length; i++) {
            html += chars[i];
            p.innerHTML = html + '<span class="ai-cursor"></span>';
            // Speed: fast for HTML tags, slower for visible chars
            if (chars[i].startsWith('<')) continue;
            await sleep(12 + Math.random() * 18);
        }
        p.innerHTML = html; // Remove cursor from finished paragraph
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===================== HELPERS =====================
function findCurrentHourIndex(times) {
    const now = new Date();
    const idx = times.findIndex(t => new Date(t) >= now);
    return idx === -1 ? 0 : idx;
}

function getUVLabel(uv) {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Moderate';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'Very High';
    return 'Extreme';
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function formatDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}
function formatHour(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}
function formatTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
    if (show) mainContent.style.display = 'none';
}
function showError(msg) {
    let toast = document.querySelector('.error-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'error-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}
function showSuccess(msg) {
    let toast = document.querySelector('.success-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'success-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
