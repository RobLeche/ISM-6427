const DEFAULT_LOCATION = { name: "Boca Raton", latitude: 26.3683, longitude: -80.1289 };

const WEATHER_CODES = {
  0: ["Clear", "☀️", "🌙"],
  1: ["Mostly Clear", "🌤️", "🌙"],
  2: ["Partly Cloudy", "⛅", "☁️"],
  3: ["Cloudy", "☁️", "☁️"],
  45: ["Fog", "🌫️", "🌫️"],
  48: ["Fog", "🌫️", "🌫️"],
  51: ["Light Drizzle", "🌦️", "🌧️"],
  53: ["Drizzle", "🌦️", "🌧️"],
  55: ["Heavy Drizzle", "🌧️", "🌧️"],
  61: ["Light Rain", "🌦️", "🌧️"],
  63: ["Rain", "🌧️", "🌧️"],
  65: ["Heavy Rain", "🌧️", "🌧️"],
  71: ["Light Snow", "🌨️", "🌨️"],
  73: ["Snow", "🌨️", "🌨️"],
  75: ["Heavy Snow", "❄️", "❄️"],
  80: ["Showers", "🌦️", "🌧️"],
  81: ["Showers", "🌧️", "🌧️"],
  82: ["Heavy Showers", "⛈️", "⛈️"],
  95: ["Thunderstorm", "⛈️", "⛈️"],
  96: ["Thunderstorm", "⛈️", "⛈️"],
  99: ["Thunderstorm", "⛈️", "⛈️"],
};

const $ = (id) => document.getElementById(id);

function describe(code, isDay = 1) {
  const [label, day, night] = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
  return { label, icon: isDay ? day : night };
}

async function loadWeather({ name, latitude, longitude }) {
  $("condition").textContent = "Loading…";
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: 7,
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(res.statusText);
    render(name, await res.json());
  } catch (err) {
    $("condition").textContent = "Unable to load weather.";
    console.error(err);
  }
}

function render(name, data) {
  const { current, hourly, daily } = data;
  const now = describe(current.weather_code, current.is_day);

  $("place").textContent = name;
  $("temp").textContent = `${Math.round(current.temperature_2m)}°`;
  $("condition").textContent = now.label;
  $("hilo").textContent = `H:${Math.round(daily.temperature_2m_max[0])}°  L:${Math.round(daily.temperature_2m_min[0])}°`;
  $("feels").textContent = `${Math.round(current.apparent_temperature)}°`;
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(current.wind_speed_10m)} mph`;
  $("uv").textContent = Math.round(daily.uv_index_max[0]);

  // Next 24 hours, starting from the current hour
  const start = Math.max(0, hourly.time.findIndex((t) => t >= current.time.slice(0, 13)));
  $("hourly").innerHTML = hourly.time
    .slice(start, start + 24)
    .map((t, i) => {
      const idx = start + i;
      const hour = new Date(t).getHours();
      const label = i === 0 ? "Now" : `${hour % 12 || 12}${hour < 12 ? "AM" : "PM"}`;
      const { icon } = describe(hourly.weather_code[idx], hourly.is_day[idx]);
      return `<div class="hour"><span>${label}</span><span class="icon">${icon}</span><span>${Math.round(hourly.temperature_2m[idx])}°</span></div>`;
    })
    .join("");

  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = weekMax - weekMin || 1;

  $("daily").innerHTML = daily.time
    .map((t, i) => {
      const day = i === 0 ? "Today" : new Date(`${t}T00:00`).toLocaleDateString("en-US", { weekday: "short" });
      const lo = daily.temperature_2m_min[i];
      const hi = daily.temperature_2m_max[i];
      const left = ((lo - weekMin) / span) * 100;
      const width = ((hi - lo) / span) * 100;
      return `<li>
        <span>${day}</span>
        <span>${describe(daily.weather_code[i]).icon}</span>
        <div class="range">
          <span class="lo">${Math.round(lo)}°</span>
          <div class="bar"><span style="left:${left}%;width:${width}%"></span></div>
          <span class="hi">${Math.round(hi)}°</span>
        </div>
      </li>`;
    })
    .join("");
}

$("search").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("query").value.trim();
  if (!q) return;

  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`);
    const { results } = await res.json();
    if (!results?.length) {
      $("condition").textContent = `No results for "${q}"`;
      return;
    }
    const r = results[0];
    loadWeather({ name: r.name, latitude: r.latitude, longitude: r.longitude });
    $("query").value = "";
  } catch (err) {
    $("condition").textContent = "Search failed.";
    console.error(err);
  }
});

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.themeChoice === theme);
  });
  try { localStorage.setItem("theme", theme); } catch {}
}

document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
  btn.addEventListener("click", () => setTheme(btn.dataset.themeChoice));
});

function greet() {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  $("greeting").textContent = `Good ${part}, Rob`;
}

setTheme(document.documentElement.dataset.theme || "system");
greet();
loadWeather(DEFAULT_LOCATION);
