/**
 * Google Maps API Integration Module
 * Substitui o antigo AWS Location Service
 */

window.LocationService = {
  // Configurações e credenciais
  config: {
    apiKey: 'AIzaSyD9tsukKaQ7e9aeBV6M4pqGg8Kso4zQVBo'
  },

  /**
   * Gera a URL dinâmica para o mapa estático da ocorrência.
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {string} - URL da imagem do mapa
   */
  getStaticMapUrl(lat, lng) {
    if (!lat || !lng) return '';
    const zoom = 15;
    const width = 800;
    const height = 400;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&key=${this.config.apiKey}`;
  },

  /**
   * Geocodifica um endereço (texto) para coordenadas [lat, lng].
   * @param {string} text - Endereço (ex: "Curitiba, PR")
   * @returns {Promise<Array>} - Retorna [lat, lng]
   */
  async geocode(text) {
    if (!text || text.trim() === '') return null;

    // Remove CEP para melhorar a busca no Nominatim (CEPs brasileiros confundem o Nominatim)
    let textNoCep = text.replace(/\b(\d{5}-?\d{3})\b/g, '').replace(/,,/g, ',').trim();
    if (textNoCep.startsWith(',')) textNoCep = textNoCep.substring(1).trim();
    if (!textNoCep) textNoCep = text;

    // Tentativa 1: Google Maps Geocoding API
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${this.config.apiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          return [loc.lat, loc.lng];
        }
      }
    } catch (error) {}

    // Tentativa 2: Nominatim (Sem CEP) - Melhor precisão para bairros/ruas no Brasil
    try {
      let nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textNoCep)}&limit=1`;
      let res = await fetch(nomUrl);
      if (res.ok) {
        let data = await res.json();
        if (data && data.length > 0) {
          console.log("Geocode resolvido via Nominatim (Sem CEP):", textNoCep);
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
      
      // Tentativa 3: Nominatim (Com CEP) fallback
      nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=1`;
      res = await fetch(nomUrl);
      if (res.ok) {
        let data = await res.json();
        if (data && data.length > 0) {
          console.log("Geocode resolvido via Nominatim (Com CEP):", text);
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
    } catch (err) {}

    // Tentativa 4: Brasil API (CEP v2) fallback final (Muitas vezes retorna apenas o centro da cidade)
    const cepMatch = text.match(/\b(\d{5}-?\d{3})\b/);
    if (cepMatch) {
      const cepStr = cepMatch[1].replace(/\D/g, '');
      try {
        const brasilApiUrl = `https://brasilapi.com.br/api/cep/v2/${cepStr}`;
        const resBrasil = await fetch(brasilApiUrl);
        if (resBrasil.ok) {
          const dataBrasil = await resBrasil.json();
          if (dataBrasil.location && dataBrasil.location.coordinates && dataBrasil.location.coordinates.latitude && dataBrasil.location.coordinates.longitude) {
            console.log("Geocode resolvido via Brasil API (Centro da Cidade) para CEP:", cepStr);
            return [parseFloat(dataBrasil.location.coordinates.latitude), parseFloat(dataBrasil.location.coordinates.longitude)];
          }
        }
      } catch (e) {}
    }

    return null;
  },

  /**
   * Decodifica polyline do Google Maps
   */
  decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
    return points;
  },

  /**
   * Calcula a rota entre duas coordenadas [lat, lng].
   * Utiliza Google Routes API (v2)
   * @param {Array} origin - Coordenadas [lat, lng]
   * @param {Array} destination - Coordenadas [lat, lng]
   * @returns {Promise<Object>} - Distância, tempo e polyline geometry
   */
  async calculateRoute(origin, destination) {
    if (!origin || !destination) return null;

    // Tentativa 1: Google Routes API v2
    try {
      const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.config.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.routeLabels'
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: origin[0],
                longitude: origin[1]
              }
            }
          },
          destination: {
            location: {
              latLng: {
                latitude: destination[0],
                longitude: destination[1]
              }
            }
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          computeAlternativeRoutes: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          let routesList = [];
          
          for (let i = 0; i < data.routes.length; i++) {
            const route = data.routes[i];
            let geometry = [];
            
            if (route.polyline && route.polyline.encodedPolyline) {
              geometry = this.decodePolyline(route.polyline.encodedPolyline);
            }

            const dist = (route.distanceMeters || 0) / 1000;
            let duration = 0;
            if (route.duration) {
              duration = parseFloat(route.duration.replace('s', ''));
            }
            
            // Adiciona uma descrição legível para a via (ex: "via BR-135")
            const routeName = route.description ? `via ${route.description}` : `Opção ${i + 1}`;
            
            // Se for a primeira rota e veio vazia, tenta OSRM
            if (geometry.length === 0 && i === 0) {
              console.warn('[Google Route] Geometria principal vazia, buscando via OSRM...');
              geometry = await this._fetchOSRMGeometry(origin, destination);
            }
            
            if (geometry.length > 0) {
              routesList.push({ id: `google_route_${i}`, name: routeName, distanceKm: dist, durationSeconds: duration, geometry: geometry, isMain: (i === 0) });
            }
          }
          
          if (routesList.length > 0) {
            console.log(`[Google Route] Retornadas ${routesList.length} rotas alternativas.`);
            return routesList;
          }
        }
      } else {
        const errBody = await response.text().catch(() => '');
        console.warn(`[Google Route] Falha HTTP ${response.status}:`, errBody);
      }
    } catch (error) {
      console.warn('[Google Route] Exceção na roteirização Google:', error.message);
    }

    // Tentativa 2: OSRM (OpenStreetMap Routing Machine) — gratuito, sem chave
    console.log('[Google Route] Usando OSRM como fallback de roteirização...');
    return await this._calculateRouteOSRM(origin, destination);
  },

  /**
   * Roteirização via OSRM (fallback gratuito baseado em OpenStreetMap).
   */
  async _calculateRouteOSRM(origin, destination) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=true`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM Error: ${response.statusText}`);

      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance || 0) / 1000;
        const durationSeconds = route.duration || 0;

        const geometry = (route.geometry && route.geometry.coordinates)
          ? route.geometry.coordinates.map(coord => [coord[1], coord[0]])
          : [];
          
        let roads = [];
        if (route.legs && route.legs.length > 0) {
           route.legs.forEach(leg => {
             if (leg.steps) {
               leg.steps.forEach(step => {
                 if (step.name && step.name.trim() !== '' && !roads.includes(step.name)) {
                   roads.push(step.name);
                 }
                 if (step.ref && step.ref.trim() !== '' && !roads.includes(step.ref)) {
                   roads.push(step.ref);
                 }
               });
             }
           });
        }
        const roadsStr = roads.length > 0 ? roads.join(', ') : null;

        console.log(`[OSRM] ${distanceKm.toFixed(1)} km | ${(durationSeconds/3600).toFixed(1)} h | ${geometry.length} pontos | Vias: ${roads.length}`);
        return [{ id: 'osrm_route_0', name: 'Rota Principal OSRM', distanceKm, durationSeconds, geometry, isMain: true, roads: roadsStr }];
      }
    } catch (err) {
      console.error('[OSRM] Falha no fallback de roteirização:', err);
    }
    return null;
  },

  /**
   * Busca apenas a geometria da rota via OSRM.
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
