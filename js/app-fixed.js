// Main Application JavaScript
class GISApps {
    constructor() {
        // Detect current origin and set appropriate API base
        const currentOrigin = window.location.origin;
        this.apiBase = currentOrigin.includes('5500') ? 'http://localhost:8081/api' : 'http://localhost:8081/api';
        
        this.locations = [];
        this.currentLocation = null;
        this.selectedCoords = null;
        this.map = null;
        this.markers = [];
        this.drawnItems = null;
        this.drawControl = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadLocations();
        this.initializeMap();
        this.setupTabs();
    }

    setupEventListeners() {
        // Form submission
        const form = document.getElementById('locationForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleLocationSubmit(e));
        }

        // Search functionality
        const searchInput = document.getElementById('searchLocations');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.filterLocations(e.target.value));
        }

        // Map click for coordinate selection
        document.addEventListener('mapInitialized', () => {
            if (this.map) {
                this.map.on('click', (e) => this.handleMapClick(e));
            }
        });
    }

    async loadLocations() {
        try {
            this.showLoading(true);
            const response = await this.apiCall('/locations');
            
            if (response.success && response.data) {
                this.locations = response.data;
                this.renderLocationsList();
                this.updateMapMarkers();
            } else {
                this.locations = [];
                this.renderLocationsList();
            }
        } catch (error) {
            console.error('Error loading locations:', error);
            this.showToast('error', 'Gagal Memuat', 'Terjadi kesalahan saat memuat data');
        } finally {
            this.showLoading(false);
        }
    }

    async handleLocationSubmit(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('locationName').value,
            category: document.getElementById('locationCategory').value,
            description: document.getElementById('locationDescription').value,
            address: document.getElementById('locationAddress').value,
            coordinates: this.selectedCoords || {
                type: 'Point',
                coordinates: [106.819561, -6.218561] // Default Jakarta coordinates
            }
        };

        try {
            this.showLoading(true);
            const response = await this.apiCall('/locations', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (response.success) {
                this.showToast('success', 'Berhasil', 'Lokasi berhasil ditambahkan');
                document.getElementById('locationForm').reset();
                document.getElementById('locationCoords').value = '';
                this.selectedCoords = null;
                await this.loadLocations();
            } else {
                this.showToast('error', 'Gagal', response.error || 'Terjadi kesalahan');
            }
        } catch (error) {
            console.error('Error saving location:', error);
            this.showToast('error', 'Gagal', 'Terjadi kesalahan saat menyimpan lokasi');
        } finally {
            this.showLoading(false);
        }
    }

    handleMapClick(e) {
        const coords = e.latlng;
        this.selectedCoords = {
            type: 'Point',
            coordinates: [coords.lng, coords.lat]
        };
        
        // Update coordinate display
        document.getElementById('locationCoords').value = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        
        // Show temporary marker
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
        }
        this.tempMarker = L.marker([coords.lat, coords.lng]).addTo(this.map);
        
        this.showToast('info', 'Koordinat Dipilih', `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}`);
    }

    renderLocationsList() {
        const container = document.getElementById('locationsList');
        if (!container) return;

        if (this.locations.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-map-marked-alt text-4xl mb-3"></i>
                    <p>Belum ada lokasi</p>
                    <p class="text-sm mt-2">Tambahkan lokasi baru menggunakan form di atas</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.locations.map(location => `
            <div class="location-card" data-id="${location.id}">
                <div class="location-card-header">
                    <div class="location-card-title">${this.escapeHtml(location.name)}</div>
                    <span class="location-card-category category-${location.category}">${location.category}</span>
                </div>
                ${location.description ? `<div class="location-card-description">${this.escapeHtml(location.description)}</div>` : ''}
                <div class="location-card-actions">
                    <div class="location-card-coords">
                        ${location.coordinates.coordinates[1].toFixed(6)}, ${location.coordinates.coordinates[0].toFixed(6)}
                    </div>
                    <div class="location-card-buttons">
                        <button class="btn-icon edit" onclick="gisApp.zoomToLocation('${location.id}')" title="Zoom to location">
                            <i class="fas fa-search-location text-xs"></i>
                        </button>
                        <button class="btn-icon delete" onclick="gisApp.deleteLocation('${location.id}')" title="Delete location">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterLocations(searchTerm) {
        const cards = document.querySelectorAll('.location-card');
        const term = searchTerm.toLowerCase();

        cards.forEach(card => {
            const title = card.querySelector('.location-card-title').textContent.toLowerCase();
            const description = card.querySelector('.location-card-description')?.textContent.toLowerCase() || '';
            
            if (title.includes(term) || description.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    async deleteLocation(locationId) {
        if (!confirm('Apakah Anda yakin ingin menghapus lokasi ini?')) {
            return;
        }

        try {
            this.showLoading(true);
            const response = await this.apiCall(`/locations/${locationId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showToast('success', 'Berhasil', 'Lokasi berhasil dihapus');
                await this.loadLocations();
            } else {
                this.showToast('error', 'Gagal', response.error || 'Terjadi kesalahan');
            }
        } catch (error) {
            console.error('Error deleting location:', error);
            this.showToast('error', 'Gagal', 'Terjadi kesalahan saat menghapus lokasi');
        } finally {
            this.showLoading(false);
        }
    }

    initializeMap() {
        // Map initialization will be handled by map.js
        // This is just a placeholder
        console.log('Map initialization placeholder');
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update button states
                tabButtons.forEach(btn => {
                    btn.classList.remove('bg-blue-500', 'text-white');
                    btn.classList.add('hover:bg-gray-100');
                });
                button.classList.add('bg-blue-500', 'text-white');
                button.classList.remove('hover:bg-gray-100');
                
                // Update content visibility
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                });
                document.getElementById(`${targetTab}-tab`).classList.remove('hidden');
            });
        });
    }

    updateMapMarkers() {
        // Will be implemented by map.js
        console.log('Updating map markers');
    }

    zoomToLocation(locationId) {
        // Will be implemented by map.js
        console.log('Zooming to location:', locationId);
    }

    async apiCall(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            
            if (error.message.includes('CORS')) {
                this.showToast('error', 'CORS Error', 'Tidak dapat terhubung ke backend. Pastikan backend berjalan di port 8081');
            } else if (error.message.includes('Failed to fetch')) {
                this.showToast('error', 'Connection Error', 'Backend tidak dapat dijangkau. Pastikan server backend berjalan.');
            } else {
                this.showToast('error', 'API Error', error.message);
            }
            
            throw error;
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    }

    showToast(type, title, message = '') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        const toastDescription = document.getElementById('toastDescription');

        if (!toast) return;

        // Set icon based on type
        const icons = {
            success: '<i class="fas fa-check-circle text-green-500 text-xl"></i>',
            error: '<i class="fas fa-times-circle text-red-500 text-xl"></i>',
            warning: '<i class="fas fa-exclamation-triangle text-yellow-500 text-xl"></i>',
            info: '<i class="fas fa-info-circle text-blue-500 text-xl"></i>'
        };

        toastIcon.innerHTML = icons[type] || icons.info;
        toastMessage.textContent = title;
        toastDescription.textContent = message;

        // Remove existing type classes
        toast.firstElementChild.classList.remove('toast-success', 'toast-error', 'toast-warning', 'toast-info');
        toast.firstElementChild.classList.add(`toast-${type}`);

        // Show toast
        toast.classList.remove('translate-x-full');

        // Auto hide after 5 seconds
        setTimeout(() => {
            hideToast();
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions
function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.add('translate-x-full');
    }
}

function closeLocationModal() {
    const modal = document.getElementById('locationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gisApp = new GISApps();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GISApps;
}
