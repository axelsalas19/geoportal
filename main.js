const SUPABASE_URL = 'https://gnknhnxasvmrejdpljux.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua25obnhhc3ZtcmVqZHBsanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTIyMDcsImV4cCI6MjA4Mzk2ODIwN30.pbuYSf7fz_3o3UScjfAr0dS_LlT-ZFwC4hbU0MTWMj4';

let map;
let departamentosLayer;
let provinciasLayer;

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

  const geojson = await r.json();

  departamentosLayer = L.geoJSON(geojson, {
    style: {
      color: '#334155',
      weight: 1,
      fillOpacity: 0.5
    }
  }).addTo(map);

  map.fitBounds(departamentosLayer.getBounds());
}

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

  const geojson = await r.json();

  provinciasLayer = L.geoJSON(geojson, {
    style: {
      color: '#f97316',
      weight: 2,
      fillOpacity: 0
    }
  });
}

function toggleCapa(tipo) {
  if (tipo === 'departamentos') {
    map.hasLayer(departamentosLayer)
      ? map.removeLayer(departamentosLayer)
      : departamentosLayer.addTo(map);
  }

  if (tipo === 'provincias') {
    map.hasLayer(provinciasLayer)
      ? map.removeLayer(provinciasLayer)
      : provinciasLayer.addTo(map);
  }
}

function aplicarFiltros() {
  // lógica original (sin cambios)
}

function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';
}
