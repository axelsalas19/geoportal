// ======================================================
// CONFIGURACIÓN SUPABASE
// ======================================================
const URL_SUPABASE = 'https://gnknhnxasvmrejdpljux.supabase.co';
const API_KEY_SUPABASE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua25obnhhc3ZtcmVqZHBsanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTIyMDcsImV4cCI6MjA4Mzk2ODIwN30.pbuYSf7fz_3o3UScjfAr0dS_LlT-ZFwC4hbU0MTWMj4';

// ======================================================
// VARIABLES GLOBALES
// ======================================================
let map = null;
let departamentosLayer = null;
let provinciasLayer = null;
let puntosLayer = null;

let listaProvincias = new Set();
let listaDepartamentos = new Set();

let provinciasCargadas = false;
let departamentosCargados = false;

let provinciasVisibles = false;
let departamentosVisibles = true;

// ======================================================
// INIT
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
  inicializarAplicacion();
});

// ======================================================
// CLASIFICACIÓN POR PORCENTAJE
// ======================================================
function clasificarPorcentaje(porcentaje) {
  if (porcentaje > 10) {
    return { nivel: 'alto', color: '#F44336' };
  }
  if (porcentaje >= 6) {
    return { nivel: 'medio', color: '#FFC107' };
  }
  return { nivel: 'bajo', color: '#4CAF50' };
}

// ======================================================
// INICIALIZACIÓN GENERAL
// ======================================================
async function inicializarAplicacion() {
  try {
    inicializarMapa();
    await cargarDepartamentos();
    cargarProvinciasEnSegundoPlano();

    setTimeout(() => {
      document.getElementById('cargando').style.display = 'none';
    }, 500);
  } catch (error) {
    console.error(error);
    mostrarEstado('Error al iniciar la aplicación', 'error');
    document.getElementById('cargando').style.display = 'none';
  }
}

// ======================================================
// MAPA
// ======================================================
function inicializarMapa() {
  map = L.map('map').setView([-38.4161, -63.6167], 5);

  L.tileLayer(
    'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    {
      attribution: '© IGN Argentina',
      maxZoom: 18
    }
  ).addTo(map);
}

// ======================================================
// STATUS
// ======================================================
function mostrarEstado(mensaje, tipo = 'info') {
  const status = document.getElementById('status');
  status.textContent = mensaje;
  status.style.display = 'block';

  if (tipo === 'error') {
    status.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
  } else if (tipo === 'success') {
    status.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
  } else {
    status.style.background = 'linear-gradient(90deg, #3b82f6, #2563eb)';
  }

  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// ======================================================
// AUTOCOMPLETE CLOSE
// ======================================================
document.addEventListener('click', e => {
  if (!e.target.closest('.filtro-grupo')) {
    document.querySelectorAll('.autocomplete-list').forEach(el => {
      el.style.display = 'none';
    });
  }
});

// ======================================================
// UTIL: CENTROIDE
// ======================================================
function calcularCentroide(coords) {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  function procesar(arr) {
    if (Array.isArray(arr[0]) && Array.isArray(arr[0][0])) {
      arr.forEach(procesar);
    } else {
      arr.forEach(c => {
        sumLng += c[0];
        sumLat += c[1];
        count++;
      });
    }
  }

  procesar(coords);
  return count ? [sumLng / count, sumLat / count] : [0, 0];
}

// ======================================================
// CARGAR DEPARTAMENTOS
// ======================================================
async function cargarDepartamentos() {
  try {
    mostrarEstado('Cargando departamentos...', 'info');

    const res = await fetch(`${URL_SUPABASE}/rest/v1/rpc/get_departamentos_geojson`, {
      method: 'POST',
      headers: {
        apikey: API_KEY_SUPABASE,
        Authorization: `Bearer ${API_KEY_SUPABASE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({})
    });

    const geojson = await res.json();

    geojson.features.forEach(f => {
      const nombre = f.properties?.nombre || f.properties?.nam;
      if (nombre) listaDepartamentos.add(nombre);
    });

    // ===== POLÍGONOS =====
    departamentosLayer = L.geoJSON(geojson, {
      style: feature => {
        const porcentaje = feature.properties.porcentaje || 0;
        const cls = clasificarPorcentaje(porcentaje);

        return {
          color: '#475569',
          weight: 1,
          fillColor: cls.color,
          fillOpacity: 0.45
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        const porcentaje = p.porcentaje || 0;
        const cls = clasificarPorcentaje(porcentaje);

        layer.feature.properties.nivel = cls.nivel;

        layer.bindPopup(`
          <strong>${p.nombre || p.nam || 'Sin nombre'}</strong><br>
          % extranjeros:
          <b style="color:${cls.color}">
            ${porcentaje.toFixed(2)}% (${cls.nivel})
          </b>
        `);

        layer.on('mouseover', () => {
          layer.setStyle({ fillOpacity: 0.7, weight: 2 });
        });

        layer.on('mouseout', () => {
          layer.setStyle({ fillOpacity: 0.45, weight: 1 });
        });
      }
    });

    // ===== PUNTOS =====
    const puntos = geojson.features.map(f => {
      const porcentaje = f.properties.porcentaje || 0;
      const cls = clasificarPorcentaje(porcentaje);
      const centro = calcularCentroide(f.geometry.coordinates);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: centro
        },
        properties: {
          nombre: f.properties.nombre || f.properties.nam,
          porcentaje,
          nivel: cls.nivel,
          color: cls.color
        }
      };
    });

    puntosLayer = L.geoJSON(
      { type: 'FeatureCollection', features: puntos },
      {
        pointToLayer: (feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            fillColor: feature.properties.color,
            color: '#ffffff',
            weight: 1,
            fillOpacity: 0.85
          }),
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindPopup(`
            <strong>${p.nombre}</strong><br>
            % extranjeros: ${p.porcentaje.toFixed(2)}% (${p.nivel})
          `);
        }
      }
    );

    departamentosLayer.addTo(map);
    puntosLayer.addTo(map);
    map.fitBounds(departamentosLayer.getBounds());

    departamentosCargados = true;
    mostrarEstado('Departamentos cargados', 'success');
  } catch (e) {
    console.error(e);
    mostrarEstado('Error cargando departamentos', 'error');
  }
}

// ======================================================
// CARGAR PROVINCIAS
// ======================================================
async function cargarProvinciasEnSegundoPlano() {
  try {
    const res = await fetch(`${URL_SUPABASE}/rest/v1/rpc/get_provincias_geojson`, {
      method: 'POST',
      headers: {
        apikey: API_KEY_SUPABASE,
        Authorization: `Bearer ${API_KEY_SUPABASE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({})
    });

    const geojson = await res.json();

    geojson.features.forEach(f => {
      const nombre = f.properties?.nombre || f.properties?.nam || f.properties?.fna;
      if (nombre) listaProvincias.add(nombre);
    });

    provinciasLayer = L.geoJSON(geojson, {
      style: {
        color: '#f97316',
        weight: 2,
        fillOpacity: 0
      }
    });

    provinciasCargadas = true;
  } catch (e) {
    console.error(e);
  }
}

// ======================================================
// TOGGLE CAPAS
// ======================================================
function toggleCapa(tipo) {
  if (tipo === 'provincias' && provinciasLayer) {
    provinciasVisibles = !provinciasVisibles;
    document
      .getElementById('btnProvincias')
      .classList.toggle('active', provinciasVisibles);

    provinciasVisibles
      ? provinciasLayer.addTo(map)
      : map.removeLayer(provinciasLayer);
  }

  if (tipo === 'departamentos' && departamentosLayer) {
    departamentosVisibles = !departamentosVisibles;
    document
      .getElementById('btnDepartamentos')
      .classList.toggle('active', departamentosVisibles);

    if (departamentosVisibles) {
      departamentosLayer.addTo(map);
      puntosLayer.addTo(map);
    } else {
      map.removeLayer(departamentosLayer);
      map.removeLayer(puntosLayer);
    }
  }

  aplicarFiltros();
}

// ======================================================
// AUTOCOMPLETE
// ======================================================
function mostrarAutocomplete(tipo) {
  const input =
    tipo === 'provincia'
      ? document.getElementById('filtroProvincia')
      : document.getElementById('filtroDepartamento');

  const list =
    tipo === 'provincia'
      ? listaProvincias
      : listaDepartamentos;

  const box = document.getElementById(`autocomplete-${tipo}`);
  const q = input.value.toLowerCase().trim();

  if (!q) {
    box.style.display = 'none';
    return;
  }

  box.innerHTML = '';
  [...list]
    .filter(n => n.toLowerCase().includes(q))
    .slice(0, 8)
    .forEach(n => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = n;
      div.onclick = () => {
        input.value = n;
        box.style.display = 'none';
        aplicarFiltros();
      };
      box.appendChild(div);
    });

  box.style.display = 'block';
}

// ======================================================
// FILTROS
// ======================================================
function aplicarFiltros() {
  const fProv = document.getElementById('filtroProvincia').value.toLowerCase();
  const fDepto = document.getElementById('filtroDepartamento').value.toLowerCase();
  const fNivel = document.getElementById('filtroNivel').value;

  if (departamentosLayer) {
    departamentosLayer.eachLayer(layer => {
      const p = layer.feature.properties;
      let visible = true;

      if (fDepto && !(p.nombre || '').toLowerCase().includes(fDepto)) visible = false;
      if (fNivel && p.nivel !== fNivel) visible = false;

      visible ? map.addLayer(layer) : map.removeLayer(layer);
    });
  }

  if (puntosLayer) {
    puntosLayer.eachLayer(layer => {
      const p = layer.feature.properties;
      let visible = true;

      if (fDepto && !p.nombre.toLowerCase().includes(fDepto)) visible = false;
      if (fNivel && p.nivel !== fNivel) visible = false;

      visible ? map.addLayer(layer) : map.removeLayer(layer);
    });
  }
}

// ======================================================
// LIMPIAR
// ======================================================
function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';
  aplicarFiltros();
}
