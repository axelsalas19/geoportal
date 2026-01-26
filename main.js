const SUPABASE_URL = 'https://gnknhnxasvmrejdpljux.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua25obnhhc3ZtcmVqZHBsanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTIyMDcsImV4cCI6MjA4Mzk2ODIwN30.pbuYSf7fz_3o3UScjfAr0dS_LlT-ZFwC4hbU0MTWMj4';

let map;
let departamentosLayer;
let provinciasLayer;

let departamentosGeojsonOriginal; // 👈 copia para filtros

document.addEventListener('DOMContentLoaded', init);

async function init() {
  map = L.map('map').setView([-38.4161, -63.6167], 5);

  L.tileLayer(
    'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    { maxZoom: 18 }
  ).addTo(map);

  await cargarDepartamentos();
  await cargarProvincias();

  document.getElementById('cargando').style.display = 'none';
}

/* =========================
   DEPARTAMENTOS
========================= */

async function cargarDepartamentos() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_departamentos_geojson`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }
  );

  const data = await r.json();

  departamentosGeojsonOriginal = data; // 👈 guardamos original

  departamentosLayer = L.geoJSON(data, {
    style: {
      color: '#334155',
      weight: 1,
      fillOpacity: 0.5
    }
  }).addTo(map);

  map.fitBounds(departamentosLayer.getBounds());
}

/* =========================
   PROVINCIAS
========================= */

async function cargarProvincias() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_provincias_geojson`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }
  );

  const data = await r.json();

  provinciasLayer = L.geoJSON(data, {
    style: {
      color: '#f97316',
      weight: 2,
      fillOpacity: 0
    }
  });
}

/* =========================
   TOGGLE CAPAS
========================= */

function toggleCapa(tipo) {
  if (tipo === 'departamentos') {
    if (map.hasLayer(departamentosLayer)) {
      map.removeLayer(departamentosLayer);
    } else {
      departamentosLayer.addTo(map);
    }
  }

  if (tipo === 'provincias') {
    if (map.hasLayer(provinciasLayer)) {
      map.removeLayer(provinciasLayer);
    } else {
      provinciasLayer.addTo(map);
    }
  }
}

/* =========================
   FILTROS
========================= */

function aplicarFiltros() {
  if (!map.hasLayer(departamentosLayer)) return;

  const provincia = document
    .getElementById('filtroProvincia')
    .value.toLowerCase();

  const departamento = document
    .getElementById('filtroDepartamento')
    .value.toLowerCase();

  const filtrados = {
    ...departamentosGeojsonOriginal,
    features: departamentosGeojsonOriginal.features.filter(f => {
      const p = f.properties || {};

      const okProvincia =
        !provincia || (p.provincia || '').toLowerCase().includes(provincia);

      const okDepartamento =
        !departamento ||
        (p.departamento || '').toLowerCase().includes(departamento);

      return okProvincia && okDepartamento;
    })
  };

  map.removeLayer(departamentosLayer);

  departamentosLayer = L.geoJSON(filtrados, {
    style: {
      color: '#334155',
      weight: 1,
      fillOpacity: 0.5
    }
  }).addTo(map);
}

function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';

  if (!departamentosGeojsonOriginal) return;

  if (map.hasLayer(departamentosLayer)) {
    map.removeLayer(departamentosLayer);
  }

  departamentosLayer = L.geoJSON(departamentosGeojsonOriginal, {
    style: {
      color: '#334155',
      weight: 1,
      fillOpacity: 0.5
    }
  }).addTo(map);
}
