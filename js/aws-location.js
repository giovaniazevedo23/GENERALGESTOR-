/**
 * AWS Location Service Integration Module
 * Utiliza chamadas REST com API Key para Geocodificação e Roteirização.
 */

window.AWSLocation = {
  // Configurações e credenciais
  config: {
    region: 'us-east-2',
    apiKey: 'v1.public.eyJqdGkiOiI0NWI1NTAwYS1kN2M3LTRlNDUtODM0YS00NWRjNjBiZjFiYzkifaI91O8DE8edoQZD2Fe4bcjsOYu0PE9Q0nbP7wODg6Ph9Sp5WftL9VL5E1en4f0EEyq_hGJgaBro-Y14jtPlLJZYCR-WB8vqtmzVKzaMpoo5frfbUeM6bEDnz0DOMsRQNovOA_1Wu1AMmFFqeM_zFu3zmerknKnLfv8H4e-i4bZSAroyVzAqEPQeyraiB7KuCXjDjWCAnw659mnRXWRkSRoCOYq1mafb7ehglwdKR7zpG2ZC0p3RSeRmK6z3fqUihR7pkXy430QBwZ0_rOFeyGL6qP_SpMc3DGQygpjrqAflRnYfO-zGDL6P9kyf02QPzJ3Iju0MXD_5pUbnuL2Xekk.NjAyMWJkZWUtMGMyOS00NmRkLThjZTMtODEyOTkzZTUyMTBi',
    placeIndexName: 'indice-lugares-general',
    routeCalculatorName: 'calculadora-rotas-general',
    mapName: 'mapa-estatico-general'
  },

  /**
   * Gera a URL dinâmica para o mapa estático da ocorrência.
   * Utiliza AWS Location Service v2 (Resource-less).
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {string} - URL da imagem do mapa
   */
  getStaticMapUrl(lat, lng) {
    if (!lat || !lng) return '';
    const zoom = 15;
    const width = 800;
    const height = 400;
    
    return `https://maps.geo.${this.config.region}.api.aws/v2/static/map?center=${lng},${lat}&zoom=${zoom}&width=${width}&height=${height}&key=${encodeURIComponent(this.config.apiKey)}`;
  },

  /**
   * Geocodifica um endereço (texto) para coordenadas [lat, lng].
   * Utiliza AWS Location Service v2 (Resource-less).
   * @param {string} text - Endereço (ex: "Curitiba, PR")
   * @returns {Promise<Array>} - Retorna [lat, lng]
   */
    async geocode(text) {
    
    if (!text || text.trim() === '') return null;

    // Tentativa 1: API Brasil (CEP v2) para precisão máxima, se houver um CEP na query
    const cepMatch = text.match(/\b(\d{5}-?\d{3})\b/);
    if (cepMatch) {
      const cepStr = cepMatch[1].replace(/\D/g, '');
      try {
        const brasilApiUrl = `https://brasilapi.com.br/api/cep/v2/${cepStr}`;
        const resBrasil = await fetch(brasilApiUrl);
        if (resBrasil.ok) {
          const dataBrasil = await resBrasil.json();
          if (dataBrasil.location && dataBrasil.location.coordinates && dataBrasil.location.coordinates.latitude && dataBrasil.location.coordinates.longitude) {
            console.log("Geocode resolvido via Brasil API para CEP:", cepStr);
            return [parseFloat(dataBrasil.location.coordinates.latitude), parseFloat(dataBrasil.location.coordinates.longitude)];
          }
        }
      } catch (e) {
        console.warn('Brasil API CEP v2 falhou:', e);
      }
    }

    // Tentativa 2: AWS Location Service
try {
      const url = `https://places.geo.${this.config.region}.api.aws/v2/geocode?key=${encodeURIComponent(this.config.apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ QueryText: text, MaxResults: 1 })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ResultItems && data.ResultItems.length > 0) {
          const point = data.ResultItems[0].Position;
          if (point && point.length === 2) return [point[1], point[0]];
        }
      }
    } catch (error) {
      console.warn('AWS Geocode falhou, tentando fallback OpenStreetMap...', error);
    }
    
    // Fallback para OpenStreetMap Nominatim
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=1`;
      const res = await fetch(nominatimUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
    } catch (err) {
      console.error('Fallback Nominatim falhou:', err);
    }

    return null;
  },

  /**
   * Calcula a rota entre duas coordenadas [lat, lng].
   * Utiliza AWS Location Service v2 (Resource-less).
   * @param {Array} origin - Coordenadas [lat, lng]
   * @param {Array} destination - Coordenadas [lat, lng]
   * @returns {Promise<Object>} - Distância, tempo e polyline geometry
   */
  async calculateRoute(origin, destination) {
    if (!origin || !destination) return null;

    // Tentativa 1: AWS Location Service Routes v2
    try {
      const url = `https://routes.geo.${this.config.region}.api.aws/v2/routes?key=${encodeURIComponent(this.config.apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Origin: [origin[1], origin[0]],          // AWS espera [Lng, Lat]
          Destination: [destination[1], destination[0]],
          TravelMode: "Car",                         // "Truck" pode ser bloqueado sem contrato
          DistanceUnit: "Kilometers",
          LegGeometryFormat: "Simple",              // Solicita LineString no retorno
          OptimizeRoutingFor: "FastestRoute"
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.Routes && data.Routes.length > 0) {
          const route = data.Routes[0];
          let geometry = [];

          // Percorre todos os Legs para montar a geometria completa
          if (route.Legs && route.Legs.length > 0) {
            for (const leg of route.Legs) {
              const ls = leg.Geometry && leg.Geometry.LineString;
              if (ls && ls.length > 0) {
                // AWS retorna [Lng, Lat] → converte para [Lat, Lng] (Leaflet)
                geometry.push(...ls.map(coord => [coord[1], coord[0]]));
              }
            }
          }

          const summary = route.Summary || {};
          // A v2 pode usar Distance (km já) ou TravelDistance (metros)
          let dist = summary.Distance ?? summary.TravelDistance ?? 0;
          if (dist > 5000) dist = dist / 1000; // converte metros → km

          const duration = summary.Duration ?? summary.DurationSeconds ?? 0;

          console.log(`[AWS Route] ${dist.toFixed(1)} km | ${(duration/3600).toFixed(1)} h | ${geometry.length} pontos`);

          // Se geometria vazia (AWS não entregou), tenta OSRM como fallback de geometria
          if (geometry.length === 0) {
            console.warn('[AWS Route] Geometria vazia, buscando geometria via OSRM...');
            geometry = await this._fetchOSRMGeometry(origin, destination);
          }

          return { distanceKm: dist, durationSeconds: duration, geometry };
        }
      } else {
        const errBody = await response.text().catch(() => '');
        console.warn(`[AWS Route] Falha HTTP ${response.status}:`, errBody);
      }
    } catch (error) {
      console.warn('[AWS Route] Exceção na roteirização AWS:', error.message);
    }

    // Tentativa 2: OSRM (OpenStreetMap Routing Machine) — gratuito, sem chave
    console.log('[AWS Route] Usando OSRM como fallback de roteirização...');
    return await this._calculateRouteOSRM(origin, destination);
  },

  /**
   * Roteirização via OSRM (fallback gratuito baseado em OpenStreetMap).
   * @param {Array} origin - [lat, lng]
   * @param {Array} destination - [lat, lng]
   */
  async _calculateRouteOSRM(origin, destination) {
    try {
      // OSRM espera coordenadas em [Lng,Lat] na URL
      const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=false`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM Error: ${response.statusText}`);

      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance || 0) / 1000;
        const durationSeconds = route.duration || 0;

        // GeoJSON LineString: coordenadas já em [Lng, Lat] → converte para [Lat, Lng]
        const geometry = (route.geometry && route.geometry.coordinates)
          ? route.geometry.coordinates.map(coord => [coord[1], coord[0]])
          : [];

        console.log(`[OSRM] ${distanceKm.toFixed(1)} km | ${(durationSeconds/3600).toFixed(1)} h | ${geometry.length} pontos`);
        return { distanceKm, durationSeconds, geometry };
      }
    } catch (err) {
      console.error('[OSRM] Falha no fallback de roteirização:', err);
    }
    return null;
  },

  /**
   * Busca apenas a geometria da rota via OSRM (usado quando AWS retorna distância mas sem polyline).
   */
  async _fetchOSRMGeometry(origin, destination) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=false`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.routes && data.routes[0] && data.routes[0].geometry) {
        return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
      }
    } catch (err) {
      console.warn('[OSRM Geometry] Falha:', err);
    }
    return [];
  }
};
