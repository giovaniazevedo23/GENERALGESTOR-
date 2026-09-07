/**
 * GENERAL App - Módulo de Mapa Interativo & Georreferenciamento (Leaflet)
 */

class GeneralMapController {
  constructor(containerId = 'incident-map') {
    this.containerId = containerId;
    this.map = null;
    this.accidentMarker = null;
    this.hazardCircle = null;
    this.emergencyMarkers = [];
  }

  init(lat = -23.7584, lng = -46.8521, zoom = 14) {
    const el = document.getElementById(this.containerId);
    if (!el || typeof L === 'undefined') return;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.map = L.map(this.containerId, {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const GeoControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: (map) => {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
        const btn = L.DomUtil.create('a', '', container);
        btn.innerHTML = '📍';
        btn.href = '#';
        btn.title = 'Minha Localização Atual';
        btn.style.fontSize = '16px';
        btn.style.lineHeight = '30px';
        btn.style.textAlign = 'center';
        btn.style.backgroundColor = '#fff';
        
        btn.onclick = (e) => {
          e.preventDefault();
          if (navigator.geolocation) {
            btn.innerHTML = '⏳';
            navigator.geolocation.getCurrentPosition((pos) => {
              btn.innerHTML = '📍';
              const { latitude, longitude } = pos.coords;
              this.updateMapLocation(latitude, longitude);
              appState.updateCurrentIncident({ lat: latitude, lng: longitude });
              if(window.App && window.App.showToast) window.App.showToast("Localização atualizada via GPS!");
            }, (err) => {
              btn.innerHTML = '📍';
              console.error(err);
              if(window.App && window.App.showToast) window.App.showToast("Erro ao obter GPS. Verifique as permissões.");
            }, { timeout: 10000, enableHighAccuracy: true });
          } else {
             if(window.App && window.App.showToast) window.App.showToast("GPS não suportado neste navegador.");
          }
        };
        return container;
      }
    });
    this.map.addControl(new GeoControl());

    this.updateMapLocation(lat, lng);

    this.map.on('click', (e) => {
      if (confirm("Deseja mover o local do incidente para esta coordenada?")) {
        const { lat, lng } = e.latlng;
        appState.updateCurrentIncident({ lat, lng });
        this.updateMapLocation(lat, lng);
        if(window.App && window.App.showToast) window.App.showToast("Local do incidente atualizado.");
      }
    });
  }

  updateMapLocation(lat, lng) {
    if (!this.map || typeof L === 'undefined') return;

    const incident = appState.getCurrentIncident();
    const hazmat = findHazmatByQuery(incident ? incident.onuCode : '');
    const isolationRadius = hazmat ? hazmat.isolamentoGrandeVazamento : 100;

    if (this.accidentMarker) this.map.removeLayer(this.accidentMarker);
    if (this.hazardCircle) this.map.removeLayer(this.hazardCircle);
    this.emergencyMarkers.forEach(m => this.map.removeLayer(m));
    this.emergencyMarkers = [];

    this.hazardCircle = L.circle([lat, lng], {
      color: '#f43f5e',
      fillColor: '#f43f5e',
      fillOpacity: 0.18,
      weight: 2,
      dashArray: '6, 6',
      radius: isolationRadius
    }).addTo(this.map);

    this.hazardCircle.bindTooltip(`🚨 Raio de Isolamento: ${isolationRadius}m`, {
      permanent: false,
      direction: 'top',
      className: 'tactical-tooltip'
    });

    const accidentIcon = L.divIcon({
      className: 'custom-accident-pin',
      html: `
        <div class="relative flex flex-col items-center">
          <div class="absolute w-6 h-6 bg-red-500 rounded-full animate-ping opacity-60 top-[6px]"></div>
          <svg class="w-10 h-10 text-red-600 drop-shadow-xl z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40]
    });

    this.accidentMarker = L.marker([lat, lng], {
      icon: accidentIcon,
      draggable: true
    }).addTo(this.map);

    this.accidentMarker.bindPopup(`
      <div class="p-2 font-sans">
        <div class="font-bold text-slate-800 text-sm mb-1">${incident ? incident.road : 'Ponto do Acidente'}</div>
        <div class="text-xs text-slate-600 mb-2">${incident ? incident.km : ''} • ${incident ? incident.city : ''}</div>
        <div class="text-xs bg-red-50 text-red-700 p-1.5 rounded border border-red-200">
          <strong>Perímetro de Segurança:</strong> ${isolationRadius} metros
        </div>
      </div>
    `);

    this.accidentMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      appState.updateCurrentIncident({ lat: pos.lat, lng: pos.lng });
      this.hazardCircle.setLatLng(pos);
    });

    this.map.panTo([lat, lng]);
  }

  drawRoutes(routesArray) {
    if (!this.map || typeof L === 'undefined' || !routesArray || routesArray.length === 0) return;

    this.clearRoute();
    this.routePolylines = [];
    
    // As rotas devem ser desenhadas da última para a primeira (z-index)
    // para que a rota principal (isMain = true, index 0) fique por cima
    const reversedRoutes = [...routesArray].reverse();

    reversedRoutes.forEach(route => {
      if (!route.geometry || route.geometry.length === 0) return;
      
      const isMain = route.isMain;
      const polyline = L.polyline(route.geometry, {
        color: isMain ? '#3b82f6' : '#94a3b8',
        weight: isMain ? 6 : 5,
        opacity: isMain ? 0.9 : 0.6,
        dashArray: isMain ? '' : '10, 10',
        lineJoin: 'round',
        interactive: true
      }).addTo(this.map);

      // Evento de clique para selecionar rota alternativa no mapa
      polyline.on('click', () => {
        window.dispatchEvent(new CustomEvent('routeSelected', { detail: { routeId: route.id } }));
      });
      
      // Hover effect
      polyline.on('mouseover', function () {
        if (!isMain) this.setStyle({ color: '#64748b', weight: 6, opacity: 0.8 });
      });
      polyline.on('mouseout', function () {
        if (!isMain) this.setStyle({ color: '#94a3b8', weight: 5, opacity: 0.6 });
      });

      this.routePolylines.push(polyline);
    });

    const mainRoute = routesArray.find(r => r.isMain) || routesArray[0];
    const originCoords = mainRoute.geometry[0];
    const destCoords = mainRoute.geometry[mainRoute.geometry.length - 1];

    const originIcon = L.divIcon({
      className: 'custom-origin-pin',
      html: `
        <div class="relative flex flex-col items-center">
          <svg class="w-8 h-8 text-emerald-500 drop-shadow-lg z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const destIcon = L.divIcon({
      className: 'custom-dest-pin',
      html: `
        <div class="relative flex flex-col items-center">
          <svg class="w-8 h-8 text-blue-500 drop-shadow-lg z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    this.originMarker = L.marker(originCoords, { icon: originIcon, zIndexOffset: 1000 }).addTo(this.map);
    this.destMarker = L.marker(destCoords, { icon: destIcon, zIndexOffset: 1000 }).addTo(this.map);

    // Ajusta o mapa para mostrar todas as rotas
    if (this.routePolylines.length > 0) {
      const group = new L.featureGroup(this.routePolylines);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }

  clearRoute() {
    if (this.routePolylines && this.map) {
      this.routePolylines.forEach(p => this.map.removeLayer(p));
      this.routePolylines = [];
    }
    if (this.originMarker && this.map) {
      this.map.removeLayer(this.originMarker);
      this.originMarker = null;
    }
    if (this.destMarker && this.map) {
      this.map.removeLayer(this.destMarker);
      this.destMarker = null;
    }
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
        // Re-fit bounds after invalidating size to ensure route is fully visible
        if (this.routePolylines && this.routePolylines.length > 0) {
          const group = new L.featureGroup(this.routePolylines);
          this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
      }, 200);
    }
  }
}

// Global instance for Dashboard
window.mapController = new GeneralMapController('incident-map');
