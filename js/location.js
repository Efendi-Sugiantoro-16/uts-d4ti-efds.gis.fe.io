// Location management JavaScript
class LocationManager {
    constructor(app) {
        this.app = app;
        this.editingLocation = null;
        this.formMode = 'create'; // 'create' or 'edit'
    }

    setupLocationForm() {
        const form = document.getElementById('locationForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.app.selectedCoords && this.formMode === 'create') {
                this.app.showToast('warning', 'Koordinat Diperlukan', 'Silakan klik pada peta untuk memilih lokasi');
                return;
            }

            const formData = this.getFormData();

            try {
                this.app.showLoading(true);
                
                let response;
                if (this.formMode === 'create') {
                    response = await this.createLocation(formData);
                } else {
                    response = await this.updateLocation(this.editingLocation.id, formData);
                }

                if (response.success) {
                    const message = this.formMode === 'create' ? 'Lokasi berhasil ditambahkan' : 'Lokasi berhasil diperbarui';
                    this.app.showToast('success', 'Berhasil', message);
                    
                    this.resetForm();
                    await this.app.loadLocations();
                    
                    // Update map
                    if (this.app.mapManager) {
                        if (this.formMode === 'create') {
                            this.app.mapManager.addLocationMarker(response.data);
                        } else {
                            // Refresh all markers
                            this.app.mapManager.addMarkersToMap();
                        }
                    }
                } else {
                    this.app.showToast('error', 'Gagal', response.error || 'Terjadi kesalahan');
                }
            } catch (error) {
                console.error('Error saving location:', error);
                this.app.showToast('error', 'Gagal', 'Terjadi kesalahan saat menyimpan lokasi');
            } finally {
                this.app.showLoading(false);
            }
        });
    }

    getFormData() {
        const coordinates = this.formMode === 'edit' && this.editingLocation 
            ? this.editingLocation.coordinates
            : {
                type: "Point",
                coordinates: [this.app.selectedCoords.lng, this.app.selectedCoords.lat]
            };

        return {
            name: document.getElementById('locationName').value,
            category: document.getElementById('locationCategory').value,
            description: document.getElementById('locationDescription').value,
            address: document.getElementById('locationAddress').value,
            coordinates: coordinates,
            properties: {}
        };
    }

    async createLocation(data) {
        if (!this.app.storage) {
            this.app.showToast('error', 'Error', 'Storage manager tidak tersedia');
            return { success: false, error: 'Storage manager tidak tersedia' };
        }
        return await this.app.storage.createLocation(data);
    }

    async updateLocation(locationId, data) {
        if (!this.app.storage) {
            this.app.showToast('error', 'Error', 'Storage manager tidak tersedia');
            return { success: false, error: 'Storage manager tidak tersedia' };
        }
        return await this.app.storage.updateLocation(locationId, data);
    }

    async deleteLocation(locationId) {
        if (!this.app.storage) {
            this.app.showToast('error', 'Error', 'Storage manager tidak tersedia');
            return { success: false, error: 'Storage manager tidak tersedia' };
        }
        return await this.app.storage.deleteLocation(locationId);
    }

    editLocation(locationId) {
        const location = this.app.locations.find(loc => loc.id === locationId);
        if (!location) return;

        this.editingLocation = location;
        this.formMode = 'edit';

        // Populate form
        document.getElementById('locationName').value = location.name || '';
        document.getElementById('locationCategory').value = location.category || 'poi';
        document.getElementById('locationDescription').value = location.description || '';
        document.getElementById('locationAddress').value = location.address || '';

        // Update form title and button
        const formTitle = document.querySelector('#locations-tab h3');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-edit mr-2"></i>Edit Lokasi';
        }

        const submitButton = document.querySelector('#locationForm button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-save mr-2"></i>Perbarui Lokasi';
        }

        // Show coordinates info
        const coordsDiv = document.querySelector('.bg-yellow-50');
        if (coordsDiv) {
            coordsDiv.innerHTML = `
                <p class="text-sm text-yellow-800">
                    <i class="fas fa-info-circle mr-1"></i>
                    Mengedit lokasi: ${location.name}
                </p>
                <p class="text-xs text-yellow-600 mt-1">
                    Koordinat: ${location.coordinates.coordinates[1].toFixed(6)}, ${location.coordinates.coordinates[0].toFixed(6)}
                </p>
            `;
        }

        // Switch to locations tab
        document.querySelector('[data-tab="locations"]').click();

        // Zoom to location on map
        if (this.app.mapManager) {
            this.app.mapManager.zoomToLocation(locationId);
        }
    }

    resetForm() {
        const form = document.getElementById('locationForm');
        if (form) {
            form.reset();
        }

        this.editingLocation = null;
        this.formMode = 'create';
        this.app.selectedCoords = null;
        document.getElementById('locationCoords').value = '';

        // Reset form title and button
        const formTitle = document.querySelector('#locations-tab h3');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>Tambah Lokasi Baru';
        }

        const submitButton = document.querySelector('#locationForm button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan Lokasi';
        }

        // Reset coordinates info
        const coordsDiv = document.querySelector('.bg-yellow-50');
        if (coordsDiv) {
            coordsDiv.innerHTML = `
                <p class="text-sm text-yellow-800">
                    <i class="fas fa-info-circle mr-1"></i>
                    Klik pada peta untuk memilih koordinat lokasi
                </p>
                <input type="hidden" id="locationCoords" value="">
            `;
        }
    }

    async duplicateLocation(locationId) {
        const location = this.app.locations.find(loc => loc.id === locationId);
        if (!location) return;

        const duplicatedData = {
            ...location,
            name: `${location.name} (Copy)`,
            coordinates: {
                ...location.coordinates,
                coordinates: [
                    location.coordinates.coordinates[0] + 0.001, // Slightly offset
                    location.coordinates.coordinates[1] + 0.001
                ]
            }
        };

        delete duplicatedData.id;
        delete duplicatedData.created_at;
        delete duplicatedData.updated_at;

        try {
            this.app.showLoading(true);
            const response = await this.createLocation(duplicatedData);

            if (response.success) {
                this.app.showToast('success', 'Berhasil', 'Lokasi berhasil diduplikasi');
                await this.app.loadLocations();
                
                if (this.app.mapManager) {
                    this.app.mapManager.addLocationMarker(response.data);
                }
            } else {
                this.app.showToast('error', 'Gagal', response.error || 'Terjadi kesalahan');
            }
        } catch (error) {
            console.error('Error duplicating location:', error);
            this.app.showToast('error', 'Gagal', 'Terjadi kesalahan saat menduplikasi lokasi');
        } finally {
            this.app.showLoading(false);
        }
    }

    async exportLocations() {
        try {
            this.app.showLoading(true);
            
            // Get locations from storage manager
            let response;
            if (this.app.storage && this.app.storage.isBackendAvailable) {
                response = await this.app.apiCall('/locations/geojson');
            } else {
                // Create GeoJSON from local storage
                const locations = this.app.storage ? this.app.storage.getLocalLocations() : this.app.locations;
                response = {
                    type: 'FeatureCollection',
                    features: locations.map(loc => ({
                        type: 'Feature',
                        geometry: loc.coordinates,
                        properties: {
                            id: loc.id,
                            name: loc.name,
                            category: loc.category,
                            description: loc.description,
                            address: loc.address,
                            created_at: loc.created_at,
                            updated_at: loc.updated_at
                        }
                    }))
                };
            }

            if (response.success || response.features) {
                const dataStr = JSON.stringify(response, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

                const exportFileDefaultName = `gis_locations_${new Date().toISOString().split('T')[0]}.geojson`;

                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();

                this.app.showToast('success', 'Berhasil', 'Data lokasi berhasil diekspor');
            } else {
                this.app.showToast('error', 'Gagal', 'Tidak dapat mengekspor data');
            }
        } catch (error) {
            console.error('Error exporting locations:', error);
            this.app.showToast('error', 'Gagal', 'Terjadi kesalahan saat mengekspor data');
        } finally {
            this.app.showLoading(false);
        }
    }

    async importLocations(file) {
        if (!file) return;

        try {
            this.app.showLoading(true);
            const text = await file.text();
            const geojson = JSON.parse(text);

            if (!geojson.features || !Array.isArray(geojson.features)) {
                throw new Error('Invalid GeoJSON format');
            }

            let importedCount = 0;
            let errorCount = 0;

            for (const feature of geojson.features) {
                try {
                    const locationData = {
                        name: feature.properties.name || 'Unnamed Location',
                        category: feature.properties.category || 'poi',
                        description: feature.properties.description || '',
                        address: feature.properties.address || '',
                        coordinates: feature.geometry,
                        properties: feature.properties
                    };

                    const response = await this.createLocation(locationData);
                    if (response.success) {
                        importedCount++;
                        // Add marker to map if available
                        if (this.app.mapManager && response.data) {
                            this.app.mapManager.addLocationMarker(response.data);
                        }
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                    console.error('Error importing feature:', error);
                }
            }

            await this.app.loadLocations();
            
            if (this.app.mapManager) {
                this.app.mapManager.addMarkersToMap();
            }

            const message = `Import selesai: ${importedCount} berhasil, ${errorCount} gagal`;
            this.app.showToast('success', 'Import Selesai', message);

        } catch (error) {
            console.error('Error importing file:', error);
            this.app.showToast('error', 'Gagal Import', 'File tidak valid atau terjadi kesalahan');
        } finally {
            this.app.showLoading(false);
        }
    }

    setupAdvancedFeatures() {
        // Add export button
        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '<i class="fas fa-download mr-2"></i>Export GeoJSON';
        exportBtn.className = 'w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors mt-3';
        exportBtn.onclick = () => this.exportLocations();

        const locationsTab = document.getElementById('locations-tab');
        const formContainer = locationsTab.querySelector('.bg-blue-50');
        if (formContainer && formContainer.nextSibling) {
            formContainer.parentNode.insertBefore(exportBtn, formContainer.nextSibling.nextSibling);
        }

        // Add import button
        const importBtn = document.createElement('label');
        importBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>Import GeoJSON';
        importBtn.className = 'w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors mt-2 cursor-pointer block text-center';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.geojson,.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.importLocations(e.target.files[0]);
        
        importBtn.appendChild(fileInput);
        locationsTab.insertBefore(importBtn, exportBtn.nextSibling);
    }

    addLocationActions() {
        // Add edit and duplicate buttons to location cards
        const observer = new MutationObserver(() => {
            document.querySelectorAll('.location-card').forEach(card => {
                if (!card.hasAttribute('data-actions-added')) {
                    const locationId = card.dataset.id;
                    const actionsDiv = card.querySelector('.location-card-buttons');
                    
                    if (actionsDiv) {
                        const editBtn = document.createElement('button');
                        editBtn.className = 'btn-icon edit';
                        editBtn.innerHTML = '<i class="fas fa-edit text-xs"></i>';
                        editBtn.title = 'Edit location';
                        editBtn.onclick = (e) => {
                            e.stopPropagation();
                            this.editLocation(locationId);
                        };

                        const duplicateBtn = document.createElement('button');
                        duplicateBtn.className = 'btn-icon';
                        duplicateBtn.style.backgroundColor = '#10b981';
                        duplicateBtn.style.color = 'white';
                        duplicateBtn.innerHTML = '<i class="fas fa-copy text-xs"></i>';
                        duplicateBtn.title = 'Duplicate location';
                        duplicateBtn.onclick = (e) => {
                            e.stopPropagation();
                            this.duplicateLocation(locationId);
                        };

                        actionsDiv.insertBefore(editBtn, actionsDiv.firstChild);
                        actionsDiv.insertBefore(duplicateBtn, actionsDiv.firstChild.nextSibling);
                        
                        card.setAttribute('data-actions-added', 'true');
                    }
                }
            });
        });

        observer.observe(document.getElementById('locationsList'), {
            childList: true,
            subtree: true
        });
    }
}

// Initialize location manager
document.addEventListener('DOMContentLoaded', () => {
    if (window.gisApp) {
        window.gisApp.locationManager = new LocationManager(window.gisApp);
        window.gisApp.locationManager.setupLocationForm();
        window.gisApp.locationManager.setupAdvancedFeatures();
        window.gisApp.locationManager.addLocationActions();
        
        // Make edit function globally available
        window.editLocation = (locationId) => {
            window.gisApp.locationManager.editLocation(locationId);
        };
    }
});
