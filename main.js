// ======================================================
// SUPABASE
// ======================================================
const SUPABASE_URL = 'https://gnknhnxasvmrejdpljux.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua25obnhhc3ZtcmVqZHBsanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTIyMDcsImV4cCI6MjA4Mzk2ODIwN30.pbuYSf7fz_3o3UScjfAr0dS_LlT-ZFwC4hbU0MTWMj4';

// ======================================================
// GLOBALES
// ======================================================
let map;
let geojsonBase;

let layerDepartamentos;
let layerPuntos;

let departamentosVisibles = true;

// ======================================================
// INIT
// ======================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  initMap();
  await cargarDatos();
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
// CENTROIDE SIMPLE
// ======================================================
function centroide(coords) {
  let x = 0, y = 0, c = 0;
  coords[0].forEach(p => {
    x += p[0];
    y += p[1];
    c++;
  });
  return [y / c, x / c];
}

// ======================================================
// CARGA DATOS
// ======================================================
async function cargarDatos() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_departamentos_geojson`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  geojsonBase = await r.json();

  geojsonBase.features.forEach(f => {
    f.properties.nivel = clasificar(f.properties.porcentaje).nivel;
  });

  crearCapas(geojsonBase);
  map.fitBounds(layerDepartamentos.getBounds());
}

// ======================================================
// CREAR CAPAS
// ======================================================
function crearCapas(data) {
  if (layerDepartamentos) map.removeLayer(layerDepartamentos);
  if (layerPuntos) map.removeLayer(layerPuntos);

  layerDepartamentos = L.geoJSON(data, {
    style: f => {
      const c = clasificar(f.properties.porcentaje);
      return {
        color: '#334155',
        weight: 1,
        fillColor: c.color,
        fillOpacity: 0.5
      };
    },
    onEachFeature: (f, l) => {
      l.bindPopup(`
        <b>${f.properties.departamento}</b><br>
        Provincia: ${f.properties.provincia}<br>
        % Extranjeros: ${f.properties.porcentaje.toFixed(2)}%
      `);
    }
  });

  layerPuntos = L.geoJSON(data, {
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
    layerDepartamentos.addTo(map);
    layerPuntos.addTo(map);
  }
}

// ======================================================
// BOTÓN DEPARTAMENTOS
// ======================================================
function toggleCapa(tipo) {
  if (tipo !== 'departamentos') return;

  departamentosVisibles = !departamentosVisibles;

  if (departamentosVisibles) {
    layerDepartamentos.addTo(map);
    layerPuntos.addTo(map);
  } else {
    map.removeLayer(layerDepartamentos);
    map.removeLayer(layerPuntos);
  }
}

// ======================================================
// BUSCAR
// ======================================================
function aplicarFiltros() {
  const prov = document.getElementById('filtroProvincia').value.toLowerCase();
  const depto = document.getElementById('filtroDepartamento').value.toLowerCase();
  const nivel = document.getElementById('filtroNivel').value;

  const filtrado = geojsonBase.features.filter(f => {
    const p = f.properties;
    if (prov && !p.provincia.toLowerCase().includes(prov)) return false;
    if (depto && !p.departamento.toLowerCase().includes(depto)) return false;
    if (nivel && p.nivel !== nivel) return false;
    return true;
  });

  crearCapas({ type: 'FeatureCollection', features: filtrado });

  if (filtrado.length) {
    map.fitBounds(layerDepartamentos.getBounds());
  }
}

// ======================================================
// LIMPIAR
// ======================================================
function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';

  crearCapas(geojsonBase);
}
