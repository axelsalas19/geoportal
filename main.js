// ======================================================
// SUPABASE
// ======================================================
const URL_SUPABASE = 'https://gnknhnxasvmrejdpljux.supabase.co';
const API_KEY_SUPABASE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua25obnhhc3ZtcmVqZHBsanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTIyMDcsImV4cCI6MjA4Mzk2ODIwN30.pbuYSf7fz_3o3UScjfAr0dS_LlT-ZFwC4hbU0MTWMj4';

// ======================================================
// GLOBALES
// ======================================================
let map;
let departamentosLayer;
let provinciasLayer;
let puntosLayer;

let departamentosVisibles = true;
let provinciasVisibles = false;

let listaProvincias = new Set();
let listaDepartamentos = new Set();

// ======================================================
// INIT
// ======================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  initMap();
  await cargarDepartamentos();
  await cargarProvincias();
  document.getElementById('cargando').style.display = 'none';
}

// ======================================================
// MAPA
// ======================================================
function initMap() {
  map = L.map('map').setView([-38.4161, -63.6167], 5);

  L.tileLayer(
    'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    { maxZoom: 18 }
  ).addTo(map);
}

// ======================================================
// CLASIFICACIÓN
// ======================================================
function clasificar(p) {
  if (p > 10) return { nivel: 'alto', color: '#F44336' };
  if (p >= 6) return { nivel: 'medio', color: '#FFC107' };
  return { nivel: 'bajo', color: '#4CAF50' };
}

// ======================================================
// CENTROIDE
// ======================================================
function centroide(coords) {
  let x = 0, y = 0, c = 0;
  (function walk(a) {
    if (Array.isArray(a[0][0])) a.forEach(walk);
    else a.forEach(p => {
      x += p[0];
      y += p[1];
      c++;
    });
  })(coords);
  return [y / c, x / c];
}

// ======================================================
// DEPARTAMENTOS
// ======================================================
async function cargarDepartamentos() {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/get_departamentos_geojson`, {
    method: 'POST',
    headers: {
      apikey: API_KEY_SUPABASE,
      Authorization: `Bearer ${API_KEY_SUPABASE}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  const gj = await r.json();

  departamentosLayer = L.geoJSON(gj, {
    style: f => {
      const c = clasificar(f.properties.porcentaje || 0);
      f.properties.nivel = c.nivel;

      listaDepartamentos.add(f.properties.departamento);
      listaProvincias.add(f.properties.provincia);

      return {
        color: '#334155',
        weight: 1,
        fillColor: c.color,
        fillOpacity: 0.5
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties;
      l.bindPopup(`
        <b>${p.departamento}</b><br>
        Provincia: ${p.provincia}<br>
        % Extranjeros: ${p.porcentaje.toFixed(2)}%
      `);
    }
  }).addTo(map);

  puntosLayer = L.geoJSON(gj, {
    coordsToLatLng: g => centroide(g.coordinates),
    pointToLayer: (f, latlng) => {
      const c = clasificar(f.properties.porcentaje || 0);
      return L.circleMarker(latlng, {
        radius: 6,
        fillColor: c.color,
        color: '#fff',
        weight: 1,
        fillOpacity: 0.9
      });
    }
  }).addTo(map);

  map.fitBounds(departamentosLayer.getBounds());
}

// ======================================================
// PROVINCIAS
// ======================================================
async function cargarProvincias() {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/get_provincias_geojson`, {
    method: 'POST',
    headers: {
      apikey: API_KEY_SUPABASE,
      Authorization: `Bearer ${API_KEY_SUPABASE}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  const gj = await r.json();

  provinciasLayer = L.geoJSON(gj, {
    style: {
      color: '#f97316',
      weight: 2,
      fillOpacity: 0
    }
  });
}

// ======================================================
// TOGGLE CAPAS (CORRECTO)
// ======================================================
function toggleCapa(tipo) {
  if (tipo === 'departamentos') {
    departamentosVisibles = !departamentosVisibles;

    if (departamentosVisibles) {
      map.addLayer(departamentosLayer);
      map.addLayer(puntosLayer);
    } else {
      map.removeLayer(departamentosLayer);
      map.removeLayer(puntosLayer);
    }
  }

  if (tipo === 'provincias') {
    provinciasVisibles = !provinciasVisibles;

    provinciasVisibles
      ? map.addLayer(provinciasLayer)
      : map.removeLayer(provinciasLayer);
  }
}

// ======================================================
// FILTROS (BUSCAR)
// ======================================================
function aplicarFiltros() {
  if (!departamentosVisibles) return;

  const provincia = document.getElementById('filtroProvincia').value.toLowerCase();
  const departamento = document.getElementById('filtroDepartamento').value.toLowerCase();
  const nivel = document.getElementById('filtroNivel').value;

  departamentosLayer.clearLayers();
  puntosLayer.clearLayers();

  const filtered = departamentosLayer.toGeoJSON().features.filter(f => {
    const p = f.properties;
    if (provincia && !p.provincia.toLowerCase().includes(provincia)) return false;
    if (departamento && !p.departamento.toLowerCase().includes(departamento)) return false;
    if (nivel && p.nivel !== nivel) return false;
    return true;
  });

  departamentosLayer.addData(filtered);
  puntosLayer.addData(filtered);

  if (filtered.length) {
    map.fitBounds(departamentosLayer.getBounds());
  }
}

// ======================================================
// LIMPIAR
// ======================================================
function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';

  if (!departamentosVisibles) return;

  departamentosLayer.clearLayers();
  puntosLayer.clearLayers();

  cargarDepartamentos();
}
