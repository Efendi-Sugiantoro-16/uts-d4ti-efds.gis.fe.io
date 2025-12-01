// Map functionality for GIS Apps
class MapManager {
    constructor(app) {
        this.app = app;
        this.map = null;
        this.markers = [];
        this.baseLayers = {};
        this.currentBaseLayer = null;
        this.drawnItems = null;
        this.drawControl = null;
        this.isDrawing = false;
        this.currentDrawType = null;
    }

    initializeMap() {
        // Check if map container exists
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('Map container #map not found!');
            return false;
        }

        try {
            // Initialize map centered on Indonesia
            this.map = L.map('map').setView([-2.5, 118], 5);

            // Setup base layers
            this.setupBaseLayers();

            // Add default base layer
            this.baseLayers.osm.addTo(this.map);
            this.currentBaseLayer = 'osm';

            // Setup drawn items layer
            this.drawnItems = new L.FeatureGroup();
            this.map.addLayer(this.drawnItems);

            // Setup map events
            this.setupMapEvents();

            // Setup layer controls
            this.setupLayerControls();

            // Setup drawing tools
            this.setupDrawingTools();

            // Add existing markers
            this.addMarkersToMap();

            // Update coordinate display
            this.updateCoordinateDisplay();

            console.log('Map initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing map:', error);
            return false;
        }
    }

    setupBaseLayers() {
        // OpenStreetMap
        this.baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        // Satellite (ESRI)
        this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        });

        // Terrain (OpenTopoMap)
        this.baseLayers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap contributors',
            maxZoom: 17
        });
    }

    setupMapEvents() {
        if (!this.map) {
            console.error('Map not initialized - cannot setup events');
            return;
        }

        try {
            console.log('Setting up map events...');
            
            // Map click event for coordinate selection
            this.map.on('click', (e) => {
                console.log('Map clicked:', e);
                if (this.app && this.app.handleMapClick) {
                    this.app.handleMapClick(e);
                } else {
                    console.error('App or handleMapClick not available');
                }
            });

            // Mobile touch events
            if (L.Browser.touch) {
                console.log('Setting up touch events for mobile...');
                
                this.map.on('touchstart', (e) => {
                    console.log('Touch start:', e);
                    L.DomEvent.preventDefault(e);
                });
                
                this.map.on('touchend', (e) => {
                    console.log('Touch end:', e);
                    if (e.touches && e.touches.length === 0) {
                        const touchPoint = e.containerPoint;
                        if (touchPoint) {
                            const latlng = this.map.containerPointToLatLng(touchPoint);
                            console.log('Converted touch to latlng:', latlng);
                            if (this.app && this.app.handleMapClick) {
                                this.app.handleMapClick({ latlng, containerPoint: touchPoint });
                            }
                        }
                    }
                });
                
                // Alternative tap event
                this.map.on('tap', (e) => {
                    console.log('Tap event:', e);
                    if (this.app && this.app.handleMapClick) {
                        this.app.handleMapClick(e);
                    }
                });
            }

            // Map move event
            this.map.on('moveend', () => {
                this.updateCoordinateDisplay();
            });

            // Emit map initialized event
            document.dispatchEvent(new CustomEvent('mapInitialized', {
                detail: { map: this.map }
            }));

            console.log('Map events setup completed');
        } catch (error) {
            console.error('Error setting up map events:', error);
        }
    }

    setupLayerControls() {
        // Base layer controls
        document.getElementById('baseLayerOSM')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.changeBaseLayer('osm');
                this.uncheckOtherBaseLayers('baseLayerOSM');
            }
        });

        document.getElementById('baseLayerSatellite')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.changeBaseLayer('satellite');
                this.uncheckOtherBaseLayers('baseLayerSatellite');
            }
        });

        document.getElementById('baseLayerTerrain')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.changeBaseLayer('terrain');
                this.uncheckOtherBaseLayers('baseLayerTerrain');
            }
        });

        // Category filters
        document.querySelectorAll('.category-filter').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.filterMarkersByCategory();
            });
        });
    }

    setupDrawingTools() {
        // Drawing tool buttons
        document.getElementById('drawMarker')?.addEventListener('click', () => {
            this.enableDrawing('marker');
        });

        document.getElementById('drawLine')?.addEventListener('click', () => {
            this.enableDrawing('polyline');
        });

        document.getElementById('drawPolygon')?.addEventListener('click', () => {
            this.enableDrawing('polygon');
        });

        document.getElementById('measureDistance')?.addEventListener('click', () => {
            this.enableMeasurement('distance');
        });

        document.getElementById('measureArea')?.addEventListener('click', () => {
            this.enableMeasurement('area');
        });

        document.getElementById('clearDrawings')?.addEventListener('click', () => {
            this.clearDrawings();
        });
    }

    changeBaseLayer(layerName) {
        if (this.currentBaseLayer && this.baseLayers[this.currentBaseLayer]) {
            this.map.removeLayer(this.baseLayers[this.currentBaseLayer]);
        }
        
        if (this.baseLayers[layerName]) {
            this.baseLayers[layerName].addTo(this.map);
            this.currentBaseLayer = layerName;
        }
    }

    uncheckOtherBaseLayers(keepChecked) {
        const baseLayers = ['baseLayerOSM', 'baseLayerSatellite', 'baseLayerTerrain'];
        baseLayers.forEach(id => {
            if (id !== keepChecked) {
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = false;
            }
        });
    }

    addMarkersToMap() {
        // Clear existing markers
        this.clearMarkers();

        // Add markers for each location
        this.app.locations.forEach(location => {
            this.addLocationMarker(location);
        });
    }

    addLocationMarker(location) {
        if (!this.map) {
            console.error('Map not initialized - cannot add marker');
            return false;
        }

        if (!location.coordinates || !location.coordinates.coordinates) {
            console.error('Invalid coordinates for location:', location);
            return false;
        }

        try {
            const coords = [location.coordinates.coordinates[1], location.coordinates.coordinates[0]];
            
            // Create custom icon based on category
            const icon = this.createCustomIcon(location.category);
            
            const marker = L.marker(coords, { icon })
                .bindPopup(this.createPopupContent(location));
            
            marker.locationId = location.id;
            marker.locationData = location;
            
            marker.addTo(this.map);
            this.markers.push(marker);

            // Add click event
            marker.on('click', () => {
                if (this.app && this.app.showLocationModal) {
                    this.app.showLocationModal(location.id);
                }
            });

            console.log('Marker added successfully for location:', location.name);
            return true;
        } catch (error) {
            console.error('Error adding marker:', error);
            return false;
        }
    }

    createCustomIcon(category) {
        const colors = {
            poi: '#3b82f6',
            restaurant: '#ef4444',
            hotel: '#8b5cf6',
            shopping: '#10b981',
            education: '#f59e0b',
            health: '#06b6d4',
            transport: '#6b7280',
            other: '#64748b'
        };

        const color = colors[category] || colors.other;

        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });
    }

    createPopupContent(location) {
        return `
            <div class="custom-popup">
                <h4 style="margin: 0 0 8px 0; font-weight: 600;">${this.app.escapeHtml(location.name)}</h4>
                ${location.description ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">${this.app.escapeHtml(location.description)}</p>` : ''}
                ${location.address ? `<p style="margin: 0 0 8px 0; font-size: 13px;"><i class="fas fa-map-marker-alt"></i> ${this.app.escapeHtml(location.address)}</p>` : ''}
                <div style="font-size: 12px; color: #999;">
                    <i class="fas fa-tag"></i> ${location.category}
                </div>
            </div>
        `;
    }

    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
    }

    removeMarker(locationId) {
        const markerIndex = this.markers.findIndex(m => m.locationId === locationId);
        if (markerIndex !== -1) {
            this.map.removeLayer(this.markers[markerIndex]);
            this.markers.splice(markerIndex, 1);
        }
    }

    filterMarkersByCategory() {
        const checkedCategories = [];
        document.querySelectorAll('.category-filter:checked').forEach(checkbox => {
            checkedCategories.push(checkbox.value);
        });

        this.markers.forEach(marker => {
            const category = marker.locationData.category;
            if (checkedCategories.includes(category)) {
                marker.addTo(this.map);
            } else {
                this.map.removeLayer(marker);
            }
        });
    }


    updateMarkers(locations) {
        console.log('Updating markers with locations:', locations);
        
        // Clear existing markers
        this.clearMarkers();

        // Add markers for each location
        locations.forEach(location => {
            this.addLocationMarker(location);
        });

        console.log(`Added ${this.markers.length} markers to map`);
    }

    addLocationMarker(location) {
        if (!this.map) {
            console.error('Map not initialized - cannot add marker');
            return false;
        }

        if (!location.coordinates || !location.coordinates.coordinates) {
            console.error('Invalid coordinates for location:', location);
            return false;
        }

        try {
            const coords = location.coordinates.coordinates; // [lng, lat]
            
            // FIXED: Validate coordinate format
            if (!Array.isArray(coords) || coords.length !== 2) {
                console.error('Invalid coordinates format for location:', location.name, coords);
                return false;
            }
            
            const [lng, lat] = coords;
            
            // FIXED: Validate coordinate values
            if (typeof lng !== 'number' || typeof lat !== 'number' ||
                isNaN(lng) || isNaN(lat) ||
                lng < -180 || lng > 180 ||
                lat < -90 || lat > 90) {
                console.error('Invalid coordinate values for location:', location.name, { lng, lat });
                return false;
            }
            
            // FIXED: Map expects [lat, lng]
            const mapCoords = [lat, lng];
            console.log('Adding marker for location:', location.name, mapCoords);
            
            // Create custom icon based on category
            const icon = this.createLocationIcon(location.category || 'other');
            
            // Create marker
            const marker = L.marker(mapCoords, { icon }).addTo(this.map);
            
            // Create popup content
            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0; color: #1f2937; font-weight: 600;">${this.escapeHtml(location.name || 'Unknown')}</h4>
                    ${location.description ? `<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">${this.escapeHtml(location.description)}</p>` : ''}
                    ${location.address ? `<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;"><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(location.address)}</p>` : ''}
                    <p style="margin: 0; color: #9ca3af; font-size: 12px; font-family: monospace;">
                        ${lat.toFixed(6)}, ${lng.toFixed(6)}
                    </p>
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button onclick="app.zoomToLocation('${location.id}')" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                            <i class="fas fa-search"></i> Zoom
                        </button>
                        <button onclick="app.editLocation('${location.id}')" style="padding: 4px 8px; background: #f59e0b; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            
            // Store marker reference and location data
            marker.locationId = location.id;
            marker.locationData = location;
            this.markers.push(marker);
            
            // Add click event
            marker.on('click', () => {
                if (this.app && this.app.showLocationModal) {
                    this.app.showLocationModal(location.id);
                }
            });

            console.log('Marker added successfully for location:', location.name, mapCoords);
            return true;
        } catch (error) {
            console.error('Error adding marker:', error);
            return false;
        }
    }

    createLocationIcon(category) {
        const colors = {
            poi: '#3b82f6',
            restaurant: '#ef4444',
            hotel: '#f59e0b',
            shopping: '#8b5cf6',
            education: '#10b981',
            health: '#ec4899',
            transport: '#6b7280',
            other: '#9ca3af'
        };
        
        const color = colors[category] || colors.other;
        
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    background: ${color};
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                ">
                    <i class="fas fa-map-marker-alt" style="font-size: 10px;"></i>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTempMarker(coords) {
        console.log('=== showTempMarker called ===');
        console.log('Coords received:', coords);
        
        if (!this.map) {
            console.error('Map not initialized - cannot show temp marker');
            return;
        }

        try {
            // FIXED: Enhanced coordinate validation and logging
            console.log('Map is available, validating coordinates...');
            
            // Validate coordinates [lat, lng]
            if (!coords || !Array.isArray(coords) || coords.length !== 2) {
                console.error('Invalid coordinates for temp marker:', coords);
                return;
            }

            const [lat, lng] = coords;
            console.log('Extracted lat/lng:', { lat, lng });
            
            // Validate lat/lng values
            if (typeof lat !== 'number' || typeof lng !== 'number' || 
                isNaN(lat) || isNaN(lng) || 
                lat < -90 || lat > 90 || 
                lng < -180 || lng > 180) {
                console.error('Invalid lat/lng values:', { lat, lng });
                return;
            }

            console.log('Coordinates validated, removing existing temp marker...');
            // Remove existing temp marker
            this.removeTempMarker();

            console.log('Creating new temp marker...');
            // Add new temp marker with better styling
            this.tempMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'temp-marker',
                    html: `
                        <div style="
                            background: #f59e0b;
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            border: 3px solid white;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                            animation: pulse 2s infinite;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <div style="
                                background: white;
                                width: 8px;
                                height: 8px;
                                border-radius: 50%;
                            "></div>
                        </div>
                    `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(this.map);

            console.log('Temp marker added to map at position:', [lat, lng]);

            // Remove temp marker after 5 seconds
            setTimeout(() => {
                this.removeTempMarker();
                console.log('Temp marker removed automatically after 5 seconds');
            }, 5000);

            console.log('=== showTempMarker completed successfully ===');
        } catch (error) {
            console.error('Error adding temp marker:', error);
        }
    }

    removeTempMarker() {
        // FIXED: Centralized method to remove temp marker
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
            this.tempMarker = null;
            console.log('Temp marker removed');
        }
    }
    addMarker(location, coords) {
        // Create custom icon based on category
        const icon = this.createCustomIcon(location.category);
        
        const marker = L.marker(coords, { icon })
            .bindPopup(this.createPopupContent(location));
        
        marker.locationId = location.id;
        marker.locationData = location;
        
        marker.addTo(this.map);
        this.markers.push(marker);

        // Add click event
        marker.on('click', () => {
            this.app.showLocationModal(location.id);
        });
    }

    zoomToLocation(locationId) {
        const location = this.app.locations.find(loc => loc.id === locationId);
        if (!location || !location.coordinates || !location.coordinates.coordinates) {
            console.error('Location not found or invalid coordinates:', locationId);
            return;
        }

        const coords = [location.coordinates.coordinates[1], location.coordinates.coordinates[0]];
        
        // Zoom to location
        this.map.setView(coords, 16);
        
        // Show popup for this location
        const marker = this.markers.find(m => m.locationData.id === locationId);
        if (marker) {
            marker.openPopup();
        }

        console.log('Zoomed to location:', location.name, coords);
    }


    enableDrawing(type) {
        // Disable any current drawing
        this.disableDrawing();

        this.isDrawing = true;
        this.currentDrawType = type;

        // Change cursor
        this.map.getContainer().style.cursor = 'crosshair';

        // Setup drawing based on type
        switch (type) {
            case 'marker':
                this.enableMarkerDrawing();
                break;
            case 'polyline':
                this.enablePolylineDrawing();
                break;
            case 'polygon':
                this.enablePolygonDrawing();
                break;
        }

        this.app.showToast('info', 'Mode Menggambar', `Klik pada peta untuk menggambar ${type}`);
    }

    enableMarkerDrawing() {
        this.map.once('click', (e) => {
            const marker = L.marker(e.latlng).addTo(this.drawnItems);
            marker.bindPopup('Marker Baru').openPopup();
            this.disableDrawing();
        });
    }

    enablePolylineDrawing() {
        const points = [];
        
        const clickHandler = (e) => {
            points.push(e.latlng);
            
            if (points.length === 1) {
                this.tempPolyline = L.polyline(points, { color: 'blue', weight: 3 }).addTo(this.drawnItems);
            } else {
                this.tempPolyline.setLatLngs(points);
            }

            // Finish drawing with double click or right click
            if (points.length >= 2) {
                this.map.once('dblclick', () => {
                    this.disableDrawing();
                });
            }
        };

        this.map.on('click', clickHandler);
        this.currentDrawHandler = clickHandler;
    }

    enablePolygonDrawing() {
        const points = [];
        
        const clickHandler = (e) => {
            points.push(e.latlng);
            
            if (points.length === 1) {
                this.tempPolygon = L.polygon(points, { color: 'green', weight: 3, fillOpacity: 0.3 }).addTo(this.drawnItems);
            } else {
                this.tempPolygon.setLatLngs(points);
            }

            // Finish drawing with double click or right click
            if (points.length >= 3) {
                this.map.once('dblclick', () => {
                    this.disableDrawing();
                });
            }
        };

        this.map.on('click', clickHandler);
        this.currentDrawHandler = clickHandler;
    }

    disableDrawing() {
        this.isDrawing = false;
        this.currentDrawType = null;
        this.map.getContainer().style.cursor = '';
        
        if (this.currentDrawHandler) {
            this.map.off('click', this.currentDrawHandler);
            this.currentDrawHandler = null;
        }
        
        this.tempPolyline = null;
        this.tempPolygon = null;
    }

    enableMeasurement(type) {
        // Disable any current drawing
        this.disableDrawing();

        this.isDrawing = true;
        this.currentDrawType = `measure-${type}`;

        // Change cursor
        this.map.getContainer().style.cursor = 'crosshair';

        if (type === 'distance') {
            this.measureDistance();
        } else if (type === 'area') {
            this.measureArea();
        }
    }

    measureDistance() {
        const points = [];
        let totalDistance = 0;

        const clickHandler = (e) => {
            points.push(e.latlng);

            if (points.length > 1) {
                const lastPoint = points[points.length - 2];
                const distance = lastPoint.distanceTo(e.latlng);
                totalDistance += distance;

                // Draw line
                L.polyline([lastPoint, e.latlng], { 
                    color: 'red', 
                    weight: 3, 
                    dashArray: '5, 10' 
                }).addTo(this.drawnItems);

                // Add distance label
                const midpoint = L.latLng(
                    (lastPoint.lat + e.latlng.lat) / 2,
                    (lastPoint.lng + e.latlng.lng) / 2
                );
                
                L.marker(midpoint, {
                    icon: L.divIcon({
                        className: 'measurement-tooltip',
                        html: `${(distance / 1000).toFixed(2)} km`,
                        iconSize: [60, 20]
                    })
                }).addTo(this.drawnItems);
            }

            // Add marker
            L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'measurement-marker',
                    html: '<div style="background: red; width: 8px; height: 8px; border-radius: 50%;"></div>',
                    iconSize: [8, 8]
                })
            }).addTo(this.drawnItems);

            // Finish with double click
            if (points.length >= 1) {
                this.map.once('dblclick', () => {
                    this.app.showToast('info', 'Pengukuran Selesai', `Total jarak: ${(totalDistance / 1000).toFixed(2)} km`);
                    this.disableDrawing();
                });
            }
        };

        this.map.on('click', clickHandler);
        this.currentDrawHandler = clickHandler;
    }

    measureArea() {
        const points = [];

        const clickHandler = (e) => {
            points.push(e.latlng);

            if (points.length >= 3) {
                // Draw polygon
                const polygon = L.polygon(points, { 
                    color: 'blue', 
                    weight: 3, 
                    fillOpacity: 0.3 
                }).addTo(this.drawnItems);

                // Calculate area
                const area = L.GeometryUtil.geodesicArea(points);
                const areaInHectares = area / 10000;

                // Add area label at centroid
                const centroid = this.getCentroid(points);
                L.marker(centroid, {
                    icon: L.divIcon({
                        className: 'measurement-tooltip',
                        html: `${areaInHectares.toFixed(2)} ha`,
                        iconSize: [80, 20]
                    })
                }).addTo(this.drawnItems);

                this.app.showToast('info', 'Pengukuran Selesai', `Luas area: ${areaInHectares.toFixed(2)} hektar`);
                this.disableDrawing();
            }
        };

        this.map.on('click', clickHandler);
        this.currentDrawHandler = clickHandler;
    }

    getCentroid(points) {
        let lat = 0, lng = 0;
        points.forEach(point => {
            lat += point.lat;
            lng += point.lng;
        });
        return L.latLng(lat / points.length, lng / points.length);
    }

    clearDrawings() {
        this.drawnItems.clearLayers();
        this.app.showToast('info', 'Bersih', 'Semua gambar telah dihapus');
    }

    updateCoordinateDisplay() {
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();

        const latElement = document.getElementById('currentLat');
        const lngElement = document.getElementById('currentLng');
        const zoomElement = document.getElementById('currentZoom');

        if (latElement) latElement.textContent = center.lat.toFixed(6);
        if (lngElement) lngElement.textContent = center.lng.toFixed(6);
        if (zoomElement) zoomElement.textContent = zoom;
    }
}

// Add CSS animation for temp marker
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    .temp-marker {
        animation: pulse 2s infinite;
    }
    
    .measurement-marker {
        background: red !important;
        border: 2px solid white !important;
        border-radius: 50% !important;
    }
`;
document.head.appendChild(style);

// Initialize map when app is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.gisApp) {
        window.gisApp.mapManager = new MapManager(window.gisApp);
        window.gisApp.initializeMap = () => {
            window.gisApp.mapManager.initializeMap();
        };
        window.gisApp.addLocationMarker = (location) => {
            window.gisApp.mapManager.addLocationMarker(location);
        };
        window.gisApp.removeMarker = (locationId) => {
            window.gisApp.mapManager.removeMarker(locationId);
        };
    }
});
