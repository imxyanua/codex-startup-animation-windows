/* Accent palettes for the overlay chrome. Artwork and avatar stay untinted. */
(function (scope) {
  'use strict';
  const palettes = {
    rose: {accent:'#e9a8bf',line:'#c8c0cd',hud:'#fce9f0',glow:'#ee96bc',cool:'#8cc3cd'},
    frost: {accent:'#b7d8ea',line:'#d5e8f0',hud:'#e8f4ff',glow:'#d7e8ff',cool:'#6aa7b8'},
    amber: {accent:'#e0b15a',line:'#e6d3b0',hud:'#f4e6c8',glow:'#f0c56e',cool:'#7a9eae'}
  };
  function normalize(value) {
    return value === 'custom' || palettes[value] ? value : 'rose';
  }
  function parseHex(value) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(value || '').trim());
    return match ? '#' + match[1].toLowerCase() : '';
  }
  function hexToRgb(hex) {
    const raw = parseHex(hex).slice(1);
    if (!raw) return [233, 168, 191];
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const from = hexToRgb(a), to = hexToRgb(b);
    return rgbToHex(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t);
  }
  function resolve(name, custom) {
    const preset = normalize(name);
    if (preset !== 'custom') return {preset, ...palettes[preset]};
    const accent = parseHex(custom) || palettes.rose.accent;
    return {
      preset: 'custom',
      accent,
      line: mix(accent, '#f4eef2', 0.42),
      hud: mix(accent, '#ffffff', 0.55),
      glow: mix(accent, '#ffffff', 0.12),
      cool: mix(accent, '#7ec8d4', 0.5)
    };
  }
  const api = {palettes, normalize, parseHex, mix, resolve};
  if (typeof module !== 'undefined') {
    module.exports = api;
    return;
  }
  scope.aemeathAccent = api;
})(typeof window === 'undefined' ? {} : window);
