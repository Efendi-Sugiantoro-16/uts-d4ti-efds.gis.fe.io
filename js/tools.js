// GIS Tools JavaScript
class GISTools {
    constructor(app) {
        this.app = app;
        this.measureTools = {
            distance: null,
            area: null
        };
        this.activeTool = null;
        this.measurements = [];
    }

    initializeTools() {
        this.setupDrawingTools();
        this.setupMeasurementTools();
        this.setupAnalysisTools();
        this.setupExportTools();
    }

    setupDrawingTools() {
        // Enhanced drawing tools with different styles
        const drawConfig = {
            marker: {
                icon: this.createCustomMarkerIcon(),
                title: 'Tambah Marker'
            },
            polyline: {
                shapeOptions: {
                    color: '#ff6b6b',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '10, 5'
                },
                title: 'Garis Polyline'
            },
            polygon: {
                shapeOptions: {
                    color: '#4ecdc4',
                    weight: 3,
                    fillOpacity: 0.3,
                    fillColor: '#4ecdc4'
                },
                title: 'Area Polygon'
            },
            circle: {
                shapeOptions: {
                    color: '#95e77e',
                    weight: 3,
                    fillOpacity: 0.2,
                    fillColor: '#95e77e'
                },
                title: 'Lingkaran'
            },
            rectangle: {
                shapeOptions: {
                    color: '#ffd93d',
                    weight: 3,
                    fillOpacity: 0.2,
                    fillColor: '#ffd93d'
                },
                title: 'Persegi Panjang'
            }
        };

        // Add circle and rectangle tools
        this.addCircleTool();
        this.addRectangleTool();
    }

    addCircleTool() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-circle mr-2"></i>Lingkaran';
        btn.className = 'w-full bg-teal-600 text-white py-2 px-4 rounded-md hover:bg-teal-700 transition-colors';
        btn.onclick = () => this.enableCircleDrawing();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    addRectangleTool() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-square mr-2"></i>Persegi Panjang';
        btn.className = 'w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 transition-colors';
        btn.onclick = () => this.enableRectangleDrawing();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    enableCircleDrawing() {
        if (!this.app.mapManager) return;

        this.disableAllTools();
        this.activeTool = 'circle';

        let centerPoint = null;
        let tempCircle = null;

        const clickHandler = (e) => {
            if (!centerPoint) {
                centerPoint = e.latlng;
                this.app.showToast('info', 'Pusat Lingkaran', 'Klik lagi untuk mengatur radius');
            } else {
                const radius = centerPoint.distanceTo(e.latlng);
                
                if (tempCircle) {
                    this.app.mapManager.drawnItems.removeLayer(tempCircle);
                }

                tempCircle = L.circle(centerPoint, {
                    radius: radius,
                    color: '#95e77e',
                    weight: 3,
                    fillOpacity: 0.2,
                    fillColor: '#95e77e'
                }).addTo(this.app.mapManager.drawnItems);

                tempCircle.bindPopup(`Radius: ${(radius / 1000).toFixed(2)} km<br>Luas: ${(Math.PI * radius * radius / 1000000).toFixed(2)} km²`).openPopup();

                this.measurements.push({
                    type: 'circle',
                    object: tempCircle,
                    radius: radius,
                    area: Math.PI * radius * radius
                });

                this.disableAllTools();
                this.app.showToast('success', 'Lingkaran Selesai', `Radius: ${(radius / 1000).toFixed(2)} km`);
            }
        };

        this.app.mapManager.map.on('click', clickHandler);
        this.currentHandler = clickHandler;
    }

    enableRectangleDrawing() {
        if (!this.app.mapManager) return;

        this.disableAllTools();
        this.activeTool = 'rectangle';

        let startPoint = null;
        let tempRectangle = null;

        const clickHandler = (e) => {
            if (!startPoint) {
                startPoint = e.latlng;
                this.app.showToast('info', 'Titik Awal', 'Klik lagi untuk menyelesaikan persegi panjang');
            } else {
                const bounds = L.latLngBounds(startPoint, e.latlng);
                
                if (tempRectangle) {
                    this.app.mapManager.drawnItems.removeLayer(tempRectangle);
                }

                tempRectangle = L.rectangle(bounds, {
                    color: '#ffd93d',
                    weight: 3,
                    fillOpacity: 0.2,
                    fillColor: '#ffd93d'
                }).addTo(this.app.mapManager.drawnItems);

                const area = this.calculateRectangleArea(bounds);
                tempRectangle.bindPopup(`Luas: ${(area / 1000000).toFixed(2)} km²<br>Ukuran: ${this.formatDimensions(bounds)}`).openPopup();

                this.measurements.push({
                    type: 'rectangle',
                    object: tempRectangle,
                    area: area,
                    bounds: bounds
                });

                this.disableAllTools();
                this.app.showToast('success', 'Persegi Panjang Selesai', `Luas: ${(area / 1000000).toFixed(2)} km²`);
            }
        };

        this.app.mapManager.map.on('click', clickHandler);
        this.currentHandler = clickHandler;
    }

    setupMeasurementTools() {
        // Enhanced distance measurement with multiple points
        this.addEnhancedDistanceTool();
        
        // Enhanced area measurement
        this.addEnhancedAreaTool();
        
        // Add buffer tool
        this.addBufferTool();
    }

    addEnhancedDistanceTool() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-route mr-2"></i>Ukur Jarak Multi';
        btn.className = 'w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors';
        btn.onclick = () => this.enableEnhancedDistanceMeasurement();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    enableEnhancedDistanceMeasurement() {
        if (!this.app.mapManager) return;

        this.disableAllTools();
        this.activeTool = 'enhanced-distance';

        const points = [];
        const lines = [];
        let totalDistance = 0;

        const clickHandler = (e) => {
            points.push(e.latlng);

            // Add marker
            const marker = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'measurement-marker',
                    html: `<div style="background: #8b5cf6; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
                    iconSize: [12, 12]
                })
            }).addTo(this.app.mapManager.drawnItems);

            if (points.length > 1) {
                const lastPoint = points[points.length - 2];
                const distance = lastPoint.distanceTo(e.latlng);
                totalDistance += distance;

                // Draw line
                const line = L.polyline([lastPoint, e.latlng], {
                    color: '#8b5cf6',
                    weight: 4,
                    opacity: 0.8,
                    dashArray: '10, 5'
                }).addTo(this.app.mapManager.drawnItems);

                lines.push(line);

                // Add distance label
                const midpoint = L.latLng(
                    (lastPoint.lat + e.latlng.lat) / 2,
                    (lastPoint.lng + e.latlng.lng) / 2
                );
                
                L.marker(midpoint, {
                    icon: L.divIcon({
                        className: 'measurement-tooltip',
                        html: `${(distance / 1000).toFixed(2)} km`,
                        iconSize: [80, 20]
                    })
                }).addTo(this.app.mapManager.drawnItems);

                // Update total distance display
                this.updateMeasurementDisplay('Jarak Total: ' + (totalDistance / 1000).toFixed(2) + ' km');
            }

            // Finish with right click
            if (points.length >= 2) {
                this.app.mapManager.map.once('contextmenu', () => {
                    this.measurements.push({
                        type: 'enhanced-distance',
                        points: points,
                        lines: lines,
                        totalDistance: totalDistance
                    });
                    this.disableAllTools();
                    this.app.showToast('success', 'Pengukuran Selesai', `Total jarak: ${(totalDistance / 1000).toFixed(2)} km`);
                });
            }
        };

        this.app.mapManager.map.on('click', clickHandler);
        this.currentHandler = clickHandler;
        
        this.app.showToast('info', 'Mode Pengukuran', 'Klik untuk menambah titik, klik kanan untuk selesai');
    }

    addEnhancedAreaTool() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-vector-square mr-2"></i>Ukur Luas Multi';
        btn.className = 'w-full bg-pink-600 text-white py-2 px-4 rounded-md hover:bg-pink-700 transition-colors';
        btn.onclick = () => this.enableEnhancedAreaMeasurement();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    enableEnhancedAreaMeasurement() {
        if (!this.app.mapManager) return;

        this.disableAllTools();
        this.activeTool = 'enhanced-area';

        const points = [];
        let tempPolygon = null;

        const clickHandler = (e) => {
            points.push(e.latlng);

            if (points.length >= 3) {
                if (tempPolygon) {
                    this.app.mapManager.drawnItems.removeLayer(tempPolygon);
                }

                tempPolygon = L.polygon(points, {
                    color: '#ec4899',
                    weight: 3,
                    fillOpacity: 0.3,
                    fillColor: '#ec4899'
                }).addTo(this.app.mapManager.drawnItems);

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
                }).addTo(this.app.mapManager.drawnItems);

                this.updateMeasurementDisplay('Luas: ' + areaInHectares.toFixed(2) + ' hektar');
            }

            // Finish with right click
            if (points.length >= 3) {
                this.app.mapManager.map.once('contextmenu', () => {
                    const area = L.GeometryUtil.geodesicArea(points);
                    this.measurements.push({
                        type: 'enhanced-area',
                        points: points,
                        polygon: tempPolygon,
                        area: area
                    });
                    this.disableAllTools();
                    this.app.showToast('success', 'Pengukuran Selesai', `Luas: ${(area / 10000).toFixed(2)} hektar`);
                });
            }
        };

        this.app.mapManager.map.on('click', clickHandler);
        this.currentHandler = clickHandler;
        
        this.app.showToast('info', 'Mode Pengukuran Area', 'Klik untuk menambah titik, klik kanan untuk selesai');
    }

    addBufferTool() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-expand-arrows-alt mr-2"></i>Buffer Area';
        btn.className = 'w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors';
        btn.onclick = () => this.enableBufferTool();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    enableBufferTool() {
        if (!this.app.mapManager) return;

        this.disableAllTools();
        this.activeTool = 'buffer';

        let centerPoint = null;
        let tempBuffer = null;

        const clickHandler = (e) => {
            if (!centerPoint) {
                centerPoint = e.latlng;
                
                // Ask for buffer radius
                const radius = prompt('Masukkan radius buffer (dalam meter):', '1000');
                if (radius && !isNaN(radius)) {
                    const radiusMeters = parseFloat(radius);
                    
                    tempBuffer = L.circle(centerPoint, {
                        radius: radiusMeters,
                        color: '#3b82f6',
                        weight: 2,
                        fillOpacity: 0.1,
                        fillColor: '#3b82f6',
                        dashArray: '5, 10'
                    }).addTo(this.app.mapManager.drawnItems);

                    tempBuffer.bindPopup(`Buffer Area<br>Radius: ${radiusMeters} m<br>Luas: ${(Math.PI * radiusMeters * radiusMeters / 1000000).toFixed(2)} km²`).openPopup();

                    this.measurements.push({
                        type: 'buffer',
                        object: tempBuffer,
                        center: centerPoint,
                        radius: radiusMeters
                    });

                    this.disableAllTools();
                    this.app.showToast('success', 'Buffer Selesai', `Radius: ${radiusMeters} m`);
                } else {
                    this.disableAllTools();
                }
            }
        };

        this.app.mapManager.map.on('click', clickHandler);
        this.currentHandler = clickHandler;
        
        this.app.showToast('info', 'Buffer Tool', 'Klik untuk membuat buffer area');
    }

    setupAnalysisTools() {
        // Add proximity analysis
        this.addProximityAnalysis();
        
        // Add density analysis
        this.addDensityAnalysis();
    }

    addProximityAnalysis() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-ruler-combined mr-2"></i>Analisis Proksimitas';
        btn.className = 'w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors';
        btn.onclick = () => this.performProximityAnalysis();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    performProximityAnalysis() {
        if (!this.app.mapManager || this.app.locations.length === 0) {
            this.app.showToast('warning', 'Tidak Ada Data', 'Tidak ada lokasi untuk dianalisis');
            return;
        }

        const distance = prompt('Masukkan jarak maksimum (dalam km):', '5');
        if (!distance || isNaN(distance)) return;

        const maxDistance = parseFloat(distance) * 1000; // Convert to meters
        const proximityGroups = [];

        this.app.locations.forEach(location1 => {
            const nearbyLocations = [];
            const coords1 = L.latLng(location1.coordinates.coordinates[1], location1.coordinates.coordinates[0]);

            this.app.locations.forEach(location2 => {
                if (location1.id !== location2.id) {
                    const coords2 = L.latLng(location2.coordinates.coordinates[1], location2.coordinates.coordinates[0]);
                    const distance = coords1.distanceTo(coords2);

                    if (distance <= maxDistance) {
                        nearbyLocations.push({
                            location: location2,
                            distance: distance
                        });
                    }
                }
            });

            if (nearbyLocations.length > 0) {
                proximityGroups.push({
                    center: location1,
                    nearby: nearbyLocations.sort((a, b) => a.distance - b.distance)
                });
            }
        });

        this.displayProximityResults(proximityGroups, maxDistance);
    }

    displayProximityResults(groups, maxDistance) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto p-6">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Hasil Analisis Proksimitas</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="mb-4">
                    <p class="text-gray-600">Jarak maksimum: ${(maxDistance / 1000).toFixed(1)} km</p>
                    <p class="text-gray-600">Total lokasi dengan tetangga: ${groups.length}</p>
                </div>
                <div class="space-y-4">
                    ${groups.map(group => `
                        <div class="border rounded-lg p-4">
                            <h4 class="font-semibold text-gray-800 mb-2">${group.center.name}</h4>
                            <p class="text-sm text-gray-600 mb-2">${group.nearby.length} lokasi terdekat:</p>
                            <ul class="space-y-1">
                                ${group.nearby.map(nearby => `
                                    <li class="text-sm text-gray-600">
                                        • ${nearby.location.name} (${(nearby.distance / 1000).toFixed(2)} km)
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-6 flex space-x-3">
                    <button onclick="this.closest('.fixed').remove()" 
                        class="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
                        Tutup
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    addDensityAnalysis() {
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-th mr-2"></i>Analisis Kepadatan';
        btn.className = 'w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors';
        btn.onclick = () => this.performDensityAnalysis();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    performDensityAnalysis() {
        if (!this.app.mapManager || this.app.locations.length === 0) {
            this.app.showToast('warning', 'Tidak Ada Data', 'Tidak ada lokasi untuk dianalisis');
            return;
        }

        const categories = {};
        this.app.locations.forEach(location => {
            if (!categories[location.category]) {
                categories[location.category] = 0;
            }
            categories[location.category]++;
        });

        this.displayDensityResults(categories);
    }

    displayDensityResults(categories) {
        const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Analisis Kepadatan</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div class="mb-4">
                    <p class="text-gray-600">Total lokasi: ${total}</p>
                </div>
                <div class="space-y-2">
                    ${Object.entries(categories).map(([category, count]) => {
                        const percentage = ((count / total) * 100).toFixed(1);
                        return `
                            <div class="flex justify-between items-center">
                                <span class="text-gray-700 capitalize">${category}</span>
                                <div class="flex items-center space-x-2">
                                    <div class="w-24 bg-gray-200 rounded-full h-2">
                                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${percentage}%"></div>
                                    </div>
                                    <span class="text-sm text-gray-600 w-12 text-right">${count} (${percentage}%)</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="mt-6">
                    <button onclick="this.closest('.fixed').remove()" 
                        class="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors">
                        Tutup
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    setupExportTools() {
        // Add export measurements button
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-file-export mr-2"></i>Export Pengukuran';
        btn.className = 'w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors';
        btn.onclick = () => this.exportMeasurements();

        const toolsTab = document.getElementById('tools-tab');
        const toolsContainer = toolsTab.querySelector('.space-y-3');
        if (toolsContainer) {
            toolsContainer.appendChild(btn);
        }
    }

    exportMeasurements() {
        if (this.measurements.length === 0) {
            this.app.showToast('warning', 'Tidak Ada Data', 'Tidak ada pengukuran untuk diekspor');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            measurements: this.measurements.map(measurement => {
                const result = {
                    type: measurement.type,
                    timestamp: new Date().toISOString()
                };

                if (measurement.type === 'circle') {
                    result.radius = measurement.radius;
                    result.area = measurement.area;
                } else if (measurement.type === 'rectangle') {
                    result.area = measurement.area;
                    result.bounds = measurement.bounds;
                } else if (measurement.type.includes('distance')) {
                    result.totalDistance = measurement.totalDistance;
                } else if (measurement.type.includes('area')) {
                    result.area = measurement.area;
                } else if (measurement.type === 'buffer') {
                    result.center = measurement.center;
                    result.radius = measurement.radius;
                }

                return result;
            })
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `gis_measurements_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        this.app.showToast('success', 'Berhasil', 'Data pengukuran berhasil diekspor');
    }

    // Utility methods
    disableAllTools() {
        this.activeTool = null;
        
        if (this.currentHandler && this.app.mapManager) {
            this.app.mapManager.map.off('click', this.currentHandler);
            this.app.mapManager.map.off('contextmenu', this.currentHandler);
            this.currentHandler = null;
        }

        if (this.app.mapManager) {
            this.app.mapManager.map.getContainer().style.cursor = '';
        }
    }

    updateMeasurementDisplay(text) {
        const infoDiv = document.querySelector('.bg-gray-50');
        if (infoDiv) {
            const measurementInfo = document.createElement('div');
            measurementInfo.className = 'mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800';
            measurementInfo.textContent = text;
            
            // Remove existing measurement info
            const existing = infoDiv.querySelector('.bg-blue-50');
            if (existing) {
                existing.remove();
            }
            
            infoDiv.appendChild(measurementInfo);
        }
    }

    getCentroid(points) {
        let lat = 0, lng = 0;
        points.forEach(point => {
            lat += point.lat;
            lng += point.lng;
        });
        return L.latLng(lat / points.length, lng / points.length);
    }

    calculateRectangleArea(bounds) {
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        // Approximate area calculation (not perfect for large areas)
        const width = northEast.distanceTo(L.latLng(northEast.lat, southWest.lng));
        const height = northEast.distanceTo(L.latLng(southWest.lat, northEast.lng));
        
        return width * height;
    }

    formatDimensions(bounds) {
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        const width = northEast.distanceTo(L.latLng(northEast.lat, southWest.lng));
        const height = northEast.distanceTo(L.latLng(southWest.lat, northEast.lng));
        
        return `${(width / 1000).toFixed(2)} km × ${(height / 1000).toFixed(2)} km`;
    }

    createCustomMarkerIcon() {
        return L.divIcon({
            className: 'custom-draw-marker',
            html: '<div style="background: #ff6b6b; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
    }
}

// Initialize GIS tools
document.addEventListener('DOMContentLoaded', () => {
    if (window.gisApp) {
        window.gisApp.gisTools = new GISTools(window.gisApp);
        window.gisApp.gisTools.initializeTools();
    }
});
