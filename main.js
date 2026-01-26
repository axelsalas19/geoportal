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
let puntosLayer;
let provinciasLayer;

let geojsonDepartamentos; // 🔑 DATA BASE

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
    else a.forEach(p => { x += p[0]; y += p[1]; c++; });
  })(coords);
  return [y / c, x / c];
}

// ======================================================
// CARGA DEPARTAMENTOS (UNA SOLA VEZ)
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

  geojsonDepartamentos = await r.json();

  geojsonDepartamentos.features.forEach(f => {
    listaDepartamentos.add(f.properties.departamento);
    listaProvincias.add(f.properties.provincia);
    f.properties.nivel = clasificar(f.properties.porcentaje).nivel;
  });

  crearCapas(geojsonDepartamentos);
  map.fitBounds(departamentosLayer.getBounds());
}

// ======================================================
// CREAR CAPAS DESDE DATA
// ======================================================
function crearCapas(data) {
  if (departamentosLayer) map.removeLayer(departamentosLayer);
  if (puntosLayer) map.removeLayer(puntosLayer);

  departamentosLayer = L.geoJSON(data, {
    style: f => {
      const c = clasificar(f.properties.porcentaje);
      return {
        color: '#334155',
        weight: 1,
        fillColor: c.color,
        fillOpacity: 0.5
      };
    }
  });

  puntosLayer = L.geoJSON(data, {
    coordsToLatLng: g => centroide(g.coordinates),
    pointToLayer: (f, latlng) => {
      const c = clasificar(f.properties.porcentaje);
      return L.circleMarker(latlng, {
        radius: 6,
        fillColor: c.color,
        color: '#fff',
        weight: 1,
        fillOpacity: 0.9
      });
    }
  });

  if (departamentosVisibles) {
    departamentosLayer.addTo(map);
    puntosLayer.addTo(map);
  }
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
    style: { color: '#f97316', weight: 2, fillOpacity: 0 }
  });
}

// ======================================================
// TOGGLE CAPAS
// ======================================================
function toggleCapa(tipo) {
  if (tipo === 'departamentos') {
    departamentosVisibles = !departamentosVisibles;
    departamentosVisibles
      ? (departamentosLayer.addTo(map), puntosLayer.addTo(map))
      : (map.removeLayer(departamentosLayer), map.removeLayer(puntosLayer));
  }

  if (tipo === 'provincias') {
    provinciasVisibles = !provinciasVisibles;
    provinciasVisibles
      ? provinciasLayer.addTo(map)
      : map.removeLayer(provinciasLayer);
  }
}

// ======================================================
// FILTROS
// ======================================================
function aplicarFiltros() {
  const prov = document.getElementById('filtroProvincia').value.toLowerCase();
  const depto = document.getElementById('filtroDepartamento').value.toLowerCase();
  const nivel = document.getElementById('filtroNivel').value;

  const filtrado = geojsonDepartamentos.features.filter(f => {
    const p = f.properties;
    if (prov && !p.provincia.toLowerCase().includes(prov)) return false;
    if (depto && !p.departamento.toLowerCase().includes(depto)) return false;
    if (nivel && p.nivel !== nivel) return false;
    return true;
  });

  crearCapas({ type: 'FeatureCollection', features: filtrado });

  if (filtrado.length) {
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

  crearCapas(geojsonDepartamentos);
}
