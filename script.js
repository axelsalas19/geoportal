// ===== CONFIGURACIÓN DE SUPABASE =====
const URL_SUPABASE = 'https://gnknhnxasvmrejdpljux.supabase.co';
const API_KEY_SUPABASE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdua25obnhhc3ZtcmVqZHBsanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzOTIyMDcsImV4cCI6MjA4Mzk2ODIwN30.pbuYSf7fz_3o3UScjfAr0dS_LlT-ZFwC4hbU0MTWMj4';

// ===== VARIABLES GLOBALES =====
let map = null;
let departamentosLayer = null;
let puntosLayer = null;
let listaProvincias = new Set();
let listaDepartamentos = new Set();

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
  inicializarAplicacion();
});

async function inicializarAplicacion() {
  try {
    // 1. Inicializar mapa
    inicializarMapa();
    
    // 2. Cargar departamentos
    await cargarDepartamentos();
    
    // 3. Ocultar pantalla de carga
    setTimeout(() => {
      document.getElementById('cargando').style.display = 'none';
    }, 500);
    
  } catch (error) {
    console.error('Error inicializando aplicación:', error);
    mostrarEstado('Error al cargar la aplicación', 'error');
    document.getElementById('cargando').style.display = 'none';
  }
}

function inicializarMapa() {
  // Inicializar mapa centrado en Argentina
  map = L.map('map').setView([-38.4161, -63.6167], 5);
  
  // Definir las capas base de ArgenMap
  var capaBase = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
    attribution: '© <a href="http://www.ign.gob.ar/">IGN Argentina</a>',
    maxZoom: 18
  });
  
  var capaSatelital = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/argenmap_hibrido@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
    attribution: '© <a href="http://www.ign.gob.ar/">IGN Argentina</a>',
    maxZoom: 18
  });
  
  var capaDark = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
    attribution: '© <a href="http://www.ign.gob.ar/">IGN Argentina</a>',
    maxZoom: 18
  });
  
  // Agregar la capa base por defecto
  capaBase.addTo(map);
  
  // Crear objeto con las capas base para el control
  var capasBase = {
    "Mapa Base": capaBase,
    "Satelital": capaSatelital,
    "Oscuro": capaDark
  };
  
L.control.layers(capasBase, null, {
  position: 'topright'     // 👈 Esquina superior derecha (por defecto)
  // position: 'topleft'    // 👈 Esquina superior izquierda
  // position: 'bottomright' // 👈 Esquina inferior derecha
  // position: 'bottomleft'  // 👈 Esquina inferior izquierda
}).addTo(map);

// ===== FUNCIONES DE UTILIDAD =====
function mostrarEstado(mensaje, tipo = 'info') {
  const status = document.getElementById('status');
  status.textContent = mensaje;
  status.style.display = 'block';
  
  if (tipo === 'error') {
    status.style.background = 'linear-gradient(90deg, #f56565, #e53e3e)';
    status.style.color = 'white';
  } else if (tipo === 'success') {
    status.style.background = 'linear-gradient(90deg, #48bb78, #38a169)';
    status.style.color = 'white';
  } else {
    status.style.background = 'linear-gradient(90deg, #4299e1, #3182ce)';
    status.style.color = 'white';
  }
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// Cerrar autocomplete al hacer clic fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('.filtro-grupo')) {
    document.querySelectorAll('.autocomplete-list').forEach(list => {
      list.style.display = 'none';
    });
  }
});

// Función para calcular el centroide correcto
function calcularCentroide(coords) {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  
  function procesarCoords(arr) {
    if (Array.isArray(arr[0]) && Array.isArray(arr[0][0])) {
      arr.forEach(poly => procesarCoords(poly));
    } else if (Array.isArray(arr[0])) {
      arr.forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          sumLng += coord[0];
          sumLat += coord[1];
          count++;
        }
      });
    }
  }
  
  procesarCoords(coords);
  
  if (count > 0) {
    return [sumLng / count, sumLat / count];
  }
  return [0, 0];
}

// ===== CARGA DE DATOS =====
async function cargarDepartamentos() {
  try {
    mostrarEstado('Cargando departamentos...', 'info');
    
    const res = await fetch(`${URL_SUPABASE}/rest/v1/rpc/get_departamentos_geojson`, {
      method: 'POST',
      headers: {
        'apikey': API_KEY_SUPABASE,
        'Authorization': `Bearer ${API_KEY_SUPABASE}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error ${res.status}: ${errorText}`);
    }

    const geojson = await res.json();
    
    if (!geojson?.features?.length) {
      throw new Error('No se encontraron datos de departamentos');
    }

    // Crear listas para autocompletar desde departamentos
    geojson.features.forEach(feature => {
      const props = feature.properties;
      
      // Lista de departamentos usando "nam"
      if (props.nam) listaDepartamentos.add(props.nam);
      if (props.nombre && !props.nam) listaDepartamentos.add(props.nombre);
      
      // Lista de provincias desde el campo "prov"
      if (props.prov) listaProvincias.add(props.prov);
    });

    // Crear capa de polígonos de departamentos
    departamentosLayer = L.geoJSON(geojson, {
      style: {
        color: '#4a5568',
        weight: 1,
        fillColor: '#e2e8f0',
        fillOpacity: 0.3
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        let popup = `<div style="padding: 8px; font-family: 'Segoe UI', sans-serif; max-width: 300px;">
          <h4 style="color: #2d3748; margin-bottom: 8px;">${props.nam || props.nombre || 'Sin nombre'}</h4>`;
        
        if (props.prov) popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>Provincia:</strong> ${props.prov}</p>`;
        if (props.fna) popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>Partido:</strong> ${props.fna}</p>`;
        if (props.sup_rural !== undefined && props.sup_rural !== null) {
          popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>Sup. rural:</strong> ${props.sup_rural.toLocaleString()} ha</p>`;
        }
        if (props.extranj_ha !== undefined && props.extranj_ha !== null) {
          popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>Extranjeros:</strong> ${props.extranj_ha.toLocaleString()} ha</p>`;
        }
        if (props.porcentaje !== undefined && props.porcentaje !== null) {
          const porcentaje = props.porcentaje.toFixed(2);
          let nivelColor = '#4CAF50';
          let nivelTexto = 'Bajo';
          
          if (props.porcentaje > 10) {
            nivelColor = '#F44336';
            nivelTexto = 'Alto';
          } else if (props.porcentaje >= 6) {
            nivelColor = '#FFC107';
            nivelTexto = 'Medio';
          }
          
          popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>% extranjeros:</strong> <span style="color: ${nivelColor}; font-weight: bold;">${porcentaje}% (${nivelTexto})</span></p>`;
        }
        popup += `</div>`;
        
        layer.bindPopup(popup);
        
        layer.on('mouseover', function() {
          this.setStyle({ 
            fillOpacity: 0.6, 
            weight: 2,
            color: '#2d3748'
          });
        });
        layer.on('mouseout', function() {
          this.setStyle({ 
            fillOpacity: 0.3, 
            weight: 1,
            color: '#4a5568'
          });
        });
      }
    });

    // Crear capa de puntos
    const puntosFeatures = [];
    
    geojson.features.forEach(feature => {
      const props = feature.properties;
      const porcentaje = props.porcentaje || 0;
      
      if (feature.geometry && feature.geometry.coordinates) {
        const center = calcularCentroide(feature.geometry.coordinates);
        
        if (center[0] !== 0 && center[1] !== 0) {
          let color = '#4CAF50';
          let nivel = 'bajo';
          
          if (porcentaje > 10) {
            color = '#F44336';
            nivel = 'alto';
          } else if (porcentaje >= 6) {
            color = '#FFC107';
            nivel = 'medio';
          }
          
          puntosFeatures.push({
            type: 'Feature',
            properties: {
              nombre: props.nam || props.nombre || 'Sin nombre',
              prov: props.prov || '',
              fna: props.fna || '',
              porcentaje: porcentaje,
              color: color,
              nivel: nivel
            },
            geometry: {
              type: 'Point',
              coordinates: [center[0], center[1]]
            }
          });
        }
      }
    });

    const puntosGeoJSON = {
      type: 'FeatureCollection',
      features: puntosFeatures
    };

    puntosLayer = L.geoJSON(puntosGeoJSON, {
      pointToLayer: function(feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: feature.properties.color,
          color: '#ffffff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
      },
      onEachFeature: function(feature, layer) {
        const props = feature.properties;
        let popup = `<div style="padding: 8px; font-family: 'Segoe UI', sans-serif;">
          <h4 style="color: #2d3748; margin-bottom: 8px;">${props.nombre}</h4>`;
        
        if (props.prov) popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>Provincia:</strong> ${props.prov}</p>`;
        if (props.fna) popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>Partido:</strong> ${props.fna}</p>`;
        if (props.porcentaje !== undefined && props.porcentaje !== null) {
          popup += `<p style="margin: 4px 0; font-size: 13px;"><strong>% extranjeros:</strong> ${props.porcentaje.toFixed(2)}%</p>`;
        }
        popup += `</div>`;
        layer.bindPopup(popup);
      }
    });

    // Mostrar capas en el mapa
    departamentosLayer.addTo(map);
    puntosLayer.addTo(map);
    map.fitBounds(departamentosLayer.getBounds());
    
    mostrarEstado('Departamentos cargados', 'success');
    
  } catch (err) {
    console.error('Error cargando departamentos:', err);
    mostrarEstado('Error cargando departamentos', 'error');
  }
}

// ===== AUTOCOMPLETADO =====
function mostrarAutocomplete(tipo) {
  let input, autocompleteDiv, lista;
  
  if (tipo === 'provincia') {
    input = document.getElementById('filtroProvincia');
    autocompleteDiv = document.getElementById('autocomplete-provincia');
    lista = Array.from(listaProvincias);
  } else {
    input = document.getElementById('filtroDepartamento');
    autocompleteDiv = document.getElementById(`autocomplete-${tipo}`);
    lista = Array.from(listaDepartamentos);
  }
  
  const query = input.value.toLowerCase().trim();
  
  if (!query) {
    autocompleteDiv.style.display = 'none';
    return;
  }
  
  const resultados = lista.filter(item => 
    item && item.toLowerCase().includes(query)
  );
  
  if (resultados.length > 0) {
    autocompleteDiv.innerHTML = '';
    resultados.slice(0, 8).forEach(item => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = item;
      div.onclick = function() {
        input.value = item;
        autocompleteDiv.style.display = 'none';
        aplicarFiltros();
      };
      autocompleteDiv.appendChild(div);
    });
    autocompleteDiv.style.display = 'block';
  } else {
    autocompleteDiv.style.display = 'none';
  }
}

// ===== FILTROS =====
function aplicarFiltros() {
  // Obtener valores de los filtros
  const filtroProvincia = document.getElementById('filtroProvincia').value.toLowerCase().trim();
  const filtroDepto = document.getElementById('filtroDepartamento').value.toLowerCase().trim();
  const filtroNivel = document.getElementById('filtroNivel').value;
  
  // Ocultar autocomplete
  document.querySelectorAll('.autocomplete-list').forEach(list => {
    list.style.display = 'none';
  });
  
  let totalDepartamentosFiltrados = 0;
  let boundsDepartamentos = null;
  
  // ===== FILTRAR DEPARTAMENTOS =====
  if (departamentosLayer && puntosLayer) {
    // Aplicar filtros a departamentos
    departamentosLayer.eachLayer(function(layer) {
      const props = layer.feature.properties;
      const nombre = (props.nam || props.nombre || '').toLowerCase();
      const provincia = (props.prov || '').toLowerCase();
      const porcentaje = props.porcentaje || 0;
      let nivel = 'bajo';
      if (porcentaje > 10) nivel = 'alto';
      else if (porcentaje >= 6) nivel = 'medio';
      
      let mostrarDepto = true;
      
      // Filtro por provincia usando el campo "prov"
      if (filtroProvincia && !provincia.includes(filtroProvincia)) {
        mostrarDepto = false;
      }
      
      // Filtro por departamento usando el campo "nam"
      if (filtroDepto && !nombre.includes(filtroDepto)) {
        mostrarDepto = false;
      }
      
      // Filtro por nivel
      if (filtroNivel && nivel !== filtroNivel) {
        mostrarDepto = false;
      }
      
      if (mostrarDepto) {
        totalDepartamentosFiltrados++;
        map.addLayer(layer);
        
        if (!boundsDepartamentos) {
          boundsDepartamentos = layer.getBounds();
        } else {
          boundsDepartamentos.extend(layer.getBounds());
        }
      } else {
        map.removeLayer(layer);
      }
    });
    
    // Aplicar filtros a puntos
    puntosLayer.eachLayer(function(layer) {
      const props = layer.feature.properties;
      const nombre = (props.nombre || '').toLowerCase();
      const provincia = (props.prov || '').toLowerCase();
      const nivel = props.nivel || 'bajo';
      
      let mostrarPunto = true;
      
      // Filtro por provincia
      if (filtroProvincia && !provincia.includes(filtroProvincia)) {
        mostrarPunto = false;
      }
      
      // Filtro por departamento
      if (filtroDepto && !nombre.includes(filtroDepto)) {
        mostrarPunto = false;
      }
      
      // Filtro por nivel
      if (filtroNivel && nivel !== filtroNivel) {
        mostrarPunto = false;
      }
      
      if (mostrarPunto) {
        map.addLayer(layer);
      } else {
        map.removeLayer(layer);
      }
    });
  }
  
  // ===== DECIDIR QUÉ ZOOM APLICAR =====
  let mensaje = '';
  let tipoMensaje = 'success';
  
  if (boundsDepartamentos && totalDepartamentosFiltrados > 0) {
    if (totalDepartamentosFiltrados === 1) {
      map.fitBounds(boundsDepartamentos, { padding: [100, 100], maxZoom: 12 });
    } else {
      map.fitBounds(boundsDepartamentos, { padding: [50, 50] });
    }
    
    mensaje = `Mostrando ${totalDepartamentosFiltrados} departamento(s)`;
    if (filtroProvincia) {
      mensaje += ` en ${filtroProvincia}`;
    }
  } else if (!filtroProvincia && !filtroDepto && !filtroNivel) {
    mensaje = 'Mostrando todos los departamentos';
    if (departamentosLayer) {
      map.fitBounds(departamentosLayer.getBounds());
    }
  } else {
    mensaje = 'No se encontraron resultados con los filtros aplicados';
    tipoMensaje = 'error';
  }
  
  if (mensaje) {
    mostrarEstado(mensaje, tipoMensaje);
  }
}

function limpiarFiltros() {
  document.getElementById('filtroProvincia').value = '';
  document.getElementById('filtroDepartamento').value = '';
  document.getElementById('filtroNivel').value = '';
  
  document.querySelectorAll('.autocomplete-list').forEach(list => {
    list.style.display = 'none';
  });
  
  aplicarFiltros();
}
