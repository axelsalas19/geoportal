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

let listaProvincias = new Set();
let listaDepartamentos = new Set();

let provinciasVisibles = false;
let departamentosVisibles = true;

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
  return [x / c, y / c];
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
      return {
        color: '#334155',
        weight: 1,
        fillColor: c.color,
        fillOpacity: 0.5
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties;
      listaDepartamentos.add(p.nombre || p.nam);

      l.bindPopup(`
        <b>${p.nombre || p.nam}</b><br>
        % Extranjeros: ${p.porcentaje.toFixed(2)} (${p.nivel})
      `);
    }
  }).addTo(map);

  // PUNTOS
  puntosLayer = L.geoJSON(gj, {
    pointToLayer: (f, latlng) => {
      const c = clasificar(f.properties.porcentaje || 0);
      return L.circleMarker(latlng, {
        radius: 6,
        fillColor: c.color,
        color: '#fff',
        weight: 1,
        fillOpacity: 0.9
      });
    },
    coordsToLatLng: g => centroide(g.coordinates)
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
    },
    onEachFeature: (f, l) => {
      listaProvincias.add(f.properties.nombre || f.properties.nam);
    }
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
// AUTOCOMPLETE
// ======================================================
function mostrarAutocomplete(tipo) {
  const input = document.getElementById(
    tipo === 'provincia' ? 'filtroProvincia' : 'filtroDepartamento'
  );
  const box = document.getElementById(`autocomplete-${tipo}`);
  const data = tipo === 'provincia' ? listaProvincias : listaDepartamentos;

  box.innerHTML = '';
  [...data]
    .filter(v => v.toLowerCase().includes(input.value.toLowerCase()))
    .slice(0, 8)
    .forEach(v => {
      const d = document.createElement('div');
      d.className = 'autocomplete-item';
      d.textContent = v;
      d.onclick = () => {
        input.value = v;
        box.style.display = 'none';
      };
      box.appendChild(d);
    });

  box.style.display = 'block';
}

// ======================================================
// FILTROS (BUSCAR)
// ======================================================
function aplicarFiltros() {
  const prov = document.getElementById('filtroProvincia').value.toLowerCase();
  const depto = document.getElementById('filtroDepartamento').value.toLowerCase();
  const nivel = document.getElementById('filtroNivel').value;

  let bounds = L.latLngBounds();

  departamentosLayer.eachLayer(l => {
    const p = l.feature.properties;
    let ok = true;

    if (depto && !p.nombre.toLowerCase().includes(depto)) ok = false;
    if (nivel && p.nivel !== nivel) ok = false;

    ok ? (l.addTo(map), bounds.extend(l.getBounds())) : map.removeLayer(l);
  });

  puntosLayer.eachLayer(l => {
    const p = l.feature.properties;
    let ok = true;

    if (depto && !p.nombre.toLowerCase().includes(depto)) ok = false;
    if (nivel && p.nivel !== nivel) ok = false;

    ok ? l.addTo(map) : map.removeLayer(l);
  });

  if (bounds.isValid()) map.fitBounds(bounds);
}

// ======================================================
// LIMPIAR
// ======================================================
function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';

  departamentosLayer.eachLayer(l => l.addTo(map));
  puntosLayer.eachLayer(l => l.addTo(map));

  map.fitBounds(departamentosLayer.getBounds());
}
