import config from '../config.js';
import { fetchJson } from '../util/http.js';

/**
 * Weather via Open-Meteo — completely keyless, so the assistant can answer
 * weather questions even with zero configuration.
 */

const WMO = [
  [[0], ['trời quang', 'clear sky']],
  [[1, 2], ['ít mây', 'partly cloudy']],
  [[3], ['nhiều mây', 'overcast']],
  [[45, 48], ['sương mù', 'fog']],
  [[51, 53, 55, 56, 57], ['mưa phùn', 'drizzle']],
  [[61, 63, 80, 81], ['mưa', 'rain']],
  [[65, 82], ['mưa to', 'heavy rain']],
  [[66, 67], ['mưa băng giá', 'freezing rain']],
  [[71, 73, 75, 77, 85, 86], ['tuyết', 'snow']],
  [[95, 96, 99], ['dông bão', 'thunderstorm']],
];

export function weatherCodeText(code, lang = 'vi') {
  for (const [codes, [vi, en]] of WMO) {
    if (codes.includes(code)) return lang === 'vi' ? vi : en;
  }
  return lang === 'vi' ? 'không xác định' : 'unknown';
}

/**
 * @param {string} place city/location name (Vietnamese or English)
 * @returns structured weather data for "now" and today's range
 */
export async function getWeather(place, { lang = 'vi' } = {}) {
  const geo = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geo.searchParams.set('name', place);
  geo.searchParams.set('count', '1');
  geo.searchParams.set('language', lang === 'vi' ? 'vi' : 'en');
  geo.searchParams.set('format', 'json');
  const geoData = await fetchJson(geo, { timeoutMs: config.searchTimeoutMs });
  const loc = geoData?.results?.[0];
  if (!loc) {
    throw new Error(lang === 'vi' ? `Không tìm thấy địa điểm "${place}"` : `Location "${place}" not found`);
  }

  const fc = new URL('https://api.open-meteo.com/v1/forecast');
  fc.searchParams.set('latitude', String(loc.latitude));
  fc.searchParams.set('longitude', String(loc.longitude));
  fc.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m');
  fc.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  fc.searchParams.set('timezone', 'auto');
  fc.searchParams.set('forecast_days', '2');
  const data = await fetchJson(fc, { timeoutMs: config.searchTimeoutMs });

  const c = data.current || {};
  const d = data.daily || {};
  return {
    location: loc.name,
    region: loc.admin1 || '',
    country: loc.country || '',
    current: {
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windKmh: c.wind_speed_10m,
      code: c.weather_code,
      description: weatherCodeText(c.weather_code, lang),
    },
    today: {
      min: d.temperature_2m_min?.[0],
      max: d.temperature_2m_max?.[0],
      rainChance: d.precipitation_probability_max?.[0],
      description: weatherCodeText(d.weather_code?.[0], lang),
    },
    tomorrow: {
      min: d.temperature_2m_min?.[1],
      max: d.temperature_2m_max?.[1],
      rainChance: d.precipitation_probability_max?.[1],
      description: weatherCodeText(d.weather_code?.[1], lang),
    },
  };
}

/** Spoken-friendly single-paragraph answer, used by direct (no-LLM) mode. */
export function formatWeatherAnswer(w, lang = 'vi') {
  const name = [w.location, w.country].filter(Boolean).join(', ');
  const t = Math.round(w.current.temperature);
  const feels = Math.round(w.current.feelsLike);
  const lo = Math.round(w.today.min);
  const hi = Math.round(w.today.max);
  if (lang === 'vi') {
    let s = `Thời tiết tại ${name}: ${w.current.description}, ${t} độ C, cảm giác như ${feels} độ, độ ẩm ${w.current.humidity}%.`;
    s += ` Hôm nay từ ${lo} đến ${hi} độ`;
    if (w.today.rainChance != null) s += `, khả năng mưa ${w.today.rainChance}%`;
    return `${s}.`;
  }
  let s = `Weather in ${name}: ${w.current.description}, ${t}°C, feels like ${feels}°, humidity ${w.current.humidity}%.`;
  s += ` Today ranges from ${lo} to ${hi}°C`;
  if (w.today.rainChance != null) s += ` with a ${w.today.rainChance}% chance of rain`;
  return `${s}.`;
}
