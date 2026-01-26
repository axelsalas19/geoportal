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

  const data = await r.json(); // 👈 ESTA variable sí existe

  departamentosLayer = L.geoJSON(data, {
    style: {
      color: '#334155',
      weight: 1,
      fillOpacity: 0.5
    }
  }).addTo(map);

  map.fitBounds(departamentosLayer.getBounds());
}
