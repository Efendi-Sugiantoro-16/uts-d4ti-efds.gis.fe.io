// Main Application JavaScript - Clean Version
class GISApps {
    constructor() {
        // FIXED: Use relative API path for GitHub Pages compatibility
        this.apiBase = window.location.hostname === 'localhost' ? 'http://localhost:8081/api' : './api';
        this.storage = null;
        this.locations = [];
        this.selectedCoords = null;
        this.mapManager = null;
        this.editMode = false;
        this.editingLocationId = null;
        
        // FIXED: Add debouncing for marker updates
        this.markerUpdateTimeout = null;
        
        this.init();
    }

    async init() {
        try {
            this.setupEventListeners();
            this.setupTabs();
            
            // Initialize map manager
            if (typeof MapManager !== 'undefined') {
                this.mapManager = new MapManager(this);
                const mapInitialized = this.mapManager.initializeMap();
                
                if (!mapInitialized) {
                    console.error('Failed to initialize map');
                    this.showToast('error', 'Map Error', 'Gagal memuat peta');
                    return;
                }
            }
            
            // FIXED: Clear any existing temp markers on initialization
            this.clearTempMarker();
            
            // Initialize storage manager
            if (typeof StorageManager !== 'undefined') {
                this.storage = new StorageManager(this.apiBase);
                await this.loadLocations();
            } else {
                console.warn('StorageManager not available');
                this.loadSampleLocations();
            }
            
            // Update storage status
            this.updateStorageStatus();
            setInterval(() => this.updateStorageStatus(), 10000);
            
            console.log('GIS Apps initialized successfully');
            
        } catch (error) {
            console.error('Error initializing GIS Apps:', error);
            this.showToast('error', 'Error', 'Gagal menginisialisasi aplikasi');
        }
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

        // Sidebar toggle for mobile
        const sidebarToggle = document.getElementById('toggleSidebar');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab);
            });
        });

        // FIXED: Ensure proper scrolling for mobile
        this.setupMobileScrolling();
        
        // FIXED: Add window resize listener for scroll height
        window.addEventListener('resize', () => {
            this.updateScrollHeight();
        });

        // Map click for coordinate selection - FIXED: Support both desktop and mobile
        document.addEventListener('mapInitialized', () => {
            if (this.mapManager && this.mapManager.map) {
                // FIXED: Update scroll height after map is initialized
                setTimeout(() => {
                    this.updateScrollHeight();
                }, 100);
                
                // Desktop click events
                this.mapManager.map.on('click', (e) => this.handleMapClick(e));
                
                // Mobile touch events
                this.mapManager.map.on('touchstart', (e) => {
                    console.log('Touch start event:', e);
                    // Prevent default to avoid scrolling
                    L.DomEvent.preventDefault(e);
                });
                
                this.mapManager.map.on('touchend', (e) => {
                    console.log('Touch end event:', e);
                    // Handle touch as click
                    if (e.touches && e.touches.length === 0) {
                        // Touch ended - get coordinates
                        const touchPoint = e.containerPoint;
                        if (touchPoint) {
                            const latlng = this.mapManager.map.containerPointToLatLng(touchPoint);
                            this.handleMapClick({ latlng, containerPoint: touchPoint });
                        }
                    }
                });
                
                // Alternative: Use tap event for mobile
                if (L.Browser.touch) {
                    console.log('Touch browser detected, setting up tap events');
                    this.mapManager.map.on('tap', (e) => {
                        console.log('Tap event:', e);
                        this.handleMapClick(e);
                    });
                }
            }
        });
    }

    setupTabs() {
        const firstTab = document.querySelector('.tab-btn[data-tab="locations"]');
        if (firstTab) {
            firstTab.classList.add('active');
        }

        const firstTabContent = document.getElementById('locations-tab');
        if (firstTabContent) {
            firstTabContent.classList.add('active');
        }
    }

    setupMobileScrolling() {
        const locationsList = document.getElementById('locationsList');
        if (locationsList) {
            console.log('Setting up scrolling for locations list');
            
            // Enable smooth scrolling
            locationsList.style.scrollBehavior = 'smooth';
            
            // Add touch scroll support for mobile
            let isScrolling = false;
            let startY = 0;
            let scrollTop = 0;
            
            locationsList.addEventListener('touchstart', (e) => {
                startY = e.touches[0].pageY;
                scrollTop = locationsList.scrollTop;
                isScrolling = true;
            }, { passive: true });
            
            locationsList.addEventListener('touchmove', (e) => {
                if (!isScrolling) return;
                
                const y = e.touches[0].pageY;
                const walk = (startY - y) * 2;
                locationsList.scrollTop = scrollTop + walk;
            }, { passive: true });
            
            locationsList.addEventListener('touchend', () => {
                setTimeout(() => {
                    isScrolling = false;
                }, 100);
            }, { passive: true });
        }
    }

    updateScrollHeight() {
        const locationsList = document.getElementById('locationsList');
        if (locationsList) {
            // Force browser to recalculate scroll
            locationsList.style.overflow = 'hidden';
            setTimeout(() => {
                locationsList.style.overflow = '';
                
                const scrollHeight = locationsList.scrollHeight;
                const clientHeight = locationsList.clientHeight;
                const canScroll = scrollHeight > clientHeight;
                
                console.log('Scroll calculation:', {
                    scrollHeight: scrollHeight,
                    clientHeight: clientHeight,
                    canScroll: canScroll,
                    locationCount: this.locations.length
                });
                
                // Add scrollable class for visual indicator
                if (canScroll) {
                    locationsList.classList.add('scrollable');
                } else {
                    locationsList.classList.remove('scrollable');
                }
                
                // Ensure proper scroll behavior
                if (canScroll) {
                    locationsList.style.overflowY = 'auto';
                    locationsList.style.overflowX = 'hidden';
                }
            }, 50);
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const targetContent = document.getElementById(`${tabName}-tab`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        // FIXED: Clear temp marker when switching away from locations tab
        if (tabName !== 'locations') {
            this.clearTempMarker();
        }
        
        // Update scroll height for the active tab
        setTimeout(() => {
            this.updateScrollHeight();
        }, 100);
    }

    updateStorageStatus() {
        if (!this.storage) return;

        const status = {
            backendAvailable: this.storage.isBackendAvailable,
            pendingSync: this.storage.pendingSync ? this.storage.pendingSync.length : 0
        };

        const indicator = document.getElementById('storageStatusIndicator');
        const statusText = document.getElementById('storageStatusText');

        if (!indicator || !statusText) return;

        if (status.backendAvailable) {
            if (status.pendingSync > 0) {
                indicator.className = 'status-dot';
                indicator.style.background = '#f59e0b';
                statusText.textContent = `Syncing (${status.pendingSync})`;
            } else {
                indicator.className = 'status-dot';
                indicator.style.background = '#10b981';
                statusText.textContent = 'Online';
            }
        } else {
            indicator.className = 'status-dot';
            indicator.style.background = '#ef4444';
            statusText.textContent = 'Offline';
        }
    }

    async handleLocationSubmit(e) {
        e.preventDefault();
        
        if (!this.selectedCoords && !this.editMode) {
            this.showToast('warning', 'Koordinat Diperlukan', 'Silakan klik pada peta untuk memilih lokasi');
            return;
        }

        const formData = this.getFormData();
        console.log('Form data:', formData);

        try {
            this.showLoading(true);
            
            let response;
            if (this.editMode) {
                response = await this.storage.updateLocation(this.editingLocationId, formData);
            } else {
                response = await this.storage.createLocation(formData);
            }

            if (response.success) {
                const message = this.editMode ? 'Lokasi berhasil diperbarui' : 'Lokasi berhasil ditambahkan';
                this.showToast('success', 'Berhasil', message);
                
                // Reload locations
                await this.loadLocations();
                
                // Reset form
                this.resetForm();
                
                // FIXED: Clear temp marker after successful save
                this.clearTempMarker();
                
                // Update map
                if (this.mapManager) {
                    if (this.editMode) {
                        // Refresh all markers
                        this.mapManager.updateMarkers(this.locations);
                    } else {
                        // Add new marker
                        if (response.data) {
                            this.mapManager.addLocationMarker(response.data);
                        }
                    }
                }
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
        console.log('=== handleMapClick called ===');
        console.log('Event object:', e);
        
        // FIXED: Handle both desktop and mobile events
        let coords;
        if (e.latlng) {
            // Desktop click
            coords = e.latlng;
            console.log('Desktop click detected, coords:', coords);
        } else if (e.containerPoint && this.mapManager && this.mapManager.map) {
            // Mobile touch - convert container point to latlng
            coords = this.mapManager.map.containerPointToLatLng(e.containerPoint);
            console.log('Mobile touch detected, converted coords:', coords);
        } else {
            console.error('Invalid map click event:', e);
            this.showToast('error', 'Error', 'Koordinat tidak valid');
            return;
        }
        
        console.log('Extracted coordinates:', coords);
        
        if (typeof coords.lat !== 'number' || typeof coords.lng !== 'number' ||
            isNaN(coords.lat) || isNaN(coords.lng) ||
            coords.lat < -90 || coords.lat > 90 ||
            coords.lng < -180 || coords.lng > 180) {
            console.error('Invalid coordinates from map click:', coords);
            this.showToast('error', 'Error', 'Koordinat tidak valid');
            return;
        }

        // FIXED: Store coordinates in consistent format [lng, lat] for GeoJSON
        this.selectedCoords = {
            type: 'Point',
            coordinates: [coords.lng, coords.lat]
        };
        
        console.log('Stored selectedCoords:', this.selectedCoords);
        
        // Update coordinate display - FIXED: Show as lat, lng for user
        const coordsElement = document.getElementById('locationCoords');
        if (coordsElement) {
            const displayValue = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
            coordsElement.value = displayValue;
            console.log('Updated coordinate display:', displayValue);
        }
        
        // Show temporary marker - FIXED: Map expects [lat, lng]
        if (this.mapManager) {
            console.log('Calling showTempMarker with coords:', [coords.lat, coords.lng]);
            this.mapManager.showTempMarker([coords.lat, coords.lng]);
        } else {
            console.error('MapManager not available!');
        }
        
        this.showToast('info', 'Koordinat Dipilih', `Lat: ${coords.lat.toFixed(6)}, Lng: ${coords.lng.toFixed(6)}`);
        console.log('=== handleMapClick completed ===');
    }

    async loadLocations() {
        try {
            if (this.storage) {
                this.locations = await this.storage.getLocations();
                console.log('Loaded locations from storage:', this.locations.length);
            } else {
                this.loadSampleLocations();
            }
            
            // Update UI
            this.renderLocationsList();
            
            // Update map markers
            if (this.mapManager) {
                this.mapManager.updateMarkers(this.locations);
            }
            
        } catch (error) {
            console.error('Error loading locations:', error);
            this.showToast('error', 'Error', 'Gagal memuat lokasi');
            this.loadSampleLocations();
        }
    }

    forceScrollEnable() {
        const tabContent = document.getElementById('locations-tab');
        if (tabContent) {
            // Enable scrolling for entire tab content
            tabContent.style.overflowY = 'auto';
            tabContent.style.overflowX = 'hidden';
            
            console.log('Full content scroll enabled:', {
                totalLocations: this.locations.length,
                tabContentHeight: tabContent.scrollHeight,
                tabClientHeight: tabContent.clientHeight,
                needsScroll: tabContent.scrollHeight > tabContent.clientHeight
            });
        }
    }

    loadSampleLocations() {
        this.locations = [
            {
                id: 'sample-1',
                name: 'Monumen Nasional',
                category: 'poi',
                description: 'Ikon Jakarta dengan tugu emas yang megah',
                address: 'Jl. Medan Merdeka, Jakarta Pusat',
                coordinates: {
                    type: 'Point',
                    coordinates: [106.830569, -6.175394]
                }
            },
            {
                id: 'sample-2',
                name: 'Bundaran HI',
                category: 'poi',
                description: 'Pusat bisnis dan landmark Jakarta',
                address: 'Jl. MH Thamrin, Jakarta Pusat',
                coordinates: {
                    type: 'Point',
                    coordinates: [106.822698, -6.193744]
                }
            },
            {
                id: 'sample-3',
                name: 'Taman Mini Indonesia Indah',
                category: 'poi',
                description: 'Taman budaya dengan anjungan seluruh provinsi Indonesia',
                address: 'Jl. Taman Mini, Jakarta Timur',
                coordinates: {
                    type: 'Point',
                    coordinates: [106.8895, -6.3024]
                }
            }
        ];
        
        // Save sample data to localStorage for persistence
        if (this.storage) {
            this.storage.setLocalLocations(this.locations);
        }
        
        this.renderLocationsList();
        this.updateMapMarkers();
        
        this.showToast('info', 'Sample Data', 'Loaded sample locations for demonstration');
    }

    renderLocationsList() {
        const container = document.getElementById('locationsList');
        const countElement = document.getElementById('locationCount');
        
        if (!container) {
            console.error('Locations container not found!');
            return;
        }

        if (countElement) {
            countElement.textContent = `${this.locations.length} lokasi`;
        }

        if (this.locations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-map-marked-alt"></i>
                    </div>
                    <div class="empty-title">Belum ada lokasi</div>
                    <div class="empty-text">Tambahkan lokasi baru untuk memulai</div>
                </div>
            `;
            
            // Force scroll enable for empty state
            setTimeout(() => this.forceScrollEnable(), 100);
            return;
        }

        // Filter locations with valid coordinates
        const validLocations = this.locations.filter(location => {
            if (!location || !location.coordinates) {
                console.warn('Location missing coordinates:', location);
                return false;
            }
            
            if (!location.coordinates.coordinates || !Array.isArray(location.coordinates.coordinates)) {
                console.warn('Location missing coordinates array:', location);
                return false;
            }
            
            const coords = location.coordinates.coordinates;
            if (coords.length !== 2) {
                console.warn('Invalid coordinates array length:', location);
                return false;
            }
            
            // Validate coordinate values [lng, lat]
            const [lng, lat] = coords;
            if (typeof lng !== 'number' || typeof lat !== 'number' ||
                isNaN(lng) || isNaN(lat) ||
                lng < -180 || lng > 180 ||
                lat < -90 || lat > 90) {
                console.warn('Invalid coordinate values:', location);
                return false;
            }
            
            return true;
        });

        if (validLocations.length !== this.locations.length) {
            console.warn(`Filtered out ${this.locations.length - validLocations.length} locations with invalid coordinates`);
        }

        // Render locations
        container.innerHTML = validLocations.map(location => {
            const coords = location.coordinates.coordinates; // [lng, lat]
            
            return `
                <div class="location-card" data-id="${location.id}">
                    <div class="location-header">
                        <div class="location-title">${this.escapeHtml(location.name || 'Unknown')}</div>
                        <span class="location-category">${location.category || 'other'}</span>
                    </div>
                    ${location.description ? `<div class="location-description">${this.escapeHtml(location.description)}</div>` : ''}
                    <div class="location-actions">
                        <div class="location-coords">${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}</div>
                        <div class="location-buttons">
                            <button class="btn-sm btn-zoom" onclick="app.zoomToLocation('${location.id}')">
                                <i class="fas fa-search"></i>
                            </button>
                            <button class="btn-sm btn-edit" onclick="app.editLocation('${location.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-sm btn-delete" onclick="app.deleteLocation('${location.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Force scroll enable after rendering
        setTimeout(() => {
            this.forceScrollEnable();
        }, 100);
    }

    filterLocations(searchTerm) {
        const cards = document.querySelectorAll('.location-card');
        const term = searchTerm.toLowerCase();

        cards.forEach(card => {
            const title = card.querySelector('.location-title').textContent.toLowerCase();
            const description = card.querySelector('.location-description')?.textContent.toLowerCase() || '';
            
            if (title.includes(term) || description.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    clearSelectedCoordinates() {
        this.selectedCoords = null;
        const coordsElement = document.getElementById('locationCoords');
        if (coordsElement) {
            coordsElement.value = '';
            coordsElement.placeholder = 'Klik pada peta untuk memilih koordinat';
        }
        
        // FIXED: Remove temp marker when coordinates are cleared
        this.clearTempMarker();
        
        console.log('Coordinates cleared and temp marker removed');
    }

    clearTempMarker() {
        // Remove temp marker if exists using centralized method
        if (this.mapManager && this.mapManager.tempMarker) {
            this.mapManager.removeTempMarker();
            console.log('Temp marker cleared via map manager');
        }
    }

    updateMapMarkers() {
        // FIXED: Debounce marker updates to prevent performance issues
        if (this.markerUpdateTimeout) {
            clearTimeout(this.markerUpdateTimeout);
        }
        
        this.markerUpdateTimeout = setTimeout(() => {
            if (this.mapManager) {
                this.mapManager.updateMarkers(this.locations);
            }
        }, 100); // 100ms debounce
    }

    showToast(type, title, message) {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        
        if (!toast || !toastIcon || !toastTitle || !toastMessage) {
            console.error('Toast elements not found');
            return;
        }
        
        const icons = {
            success: '<i class="fas fa-check-circle" style="color: #10b981;"></i>',
            error: '<i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>',
            warning: '<i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>',
            info: '<i class="fas fa-info-circle" style="color: #3b82f6;"></i>'
        };
        
        toastIcon.innerHTML = icons[type] || icons.info;
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    zoomToLocation(locationId) {
        const location = this.locations.find(loc => loc.id === locationId);
        if (location && this.mapManager && this.mapManager.map) {
            const coords = location.coordinates.coordinates; // [lng, lat]
            // FIXED: Map expects [lat, lng], so we need to convert
            this.mapManager.map.setView([coords[1], coords[0]], 16);
        }
    }

    getFormData() {
        const coordinates = this.editMode && this.editingLocation 
            ? this.editingLocation.coordinates
            : this.selectedCoords;

        return {
            name: document.getElementById('locationName')?.value || '',
            category: document.getElementById('locationCategory')?.value || 'poi',
            description: document.getElementById('locationDescription')?.value || '',
            address: document.getElementById('locationAddress')?.value || '',
            coordinates: coordinates,
            properties: {}
        };
    }

    resetForm() {
        const form = document.getElementById('locationForm');
        if (form) {
            form.reset();
        }

        this.editMode = false;
        this.editingLocationId = null;
        this.selectedCoords = null;
        
        // Clear coordinate display
        const coordsElement = document.getElementById('locationCoords');
        if (coordsElement) {
            coordsElement.value = '';
            coordsElement.placeholder = 'Klik pada peta untuk memilih koordinat';
        }

        // FIXED: Clear temp marker when form is reset
        this.clearTempMarker();

        // Reset form title
        const formTitle = document.querySelector('#locations-tab h3');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>Tambah Lokasi Baru';
        }

        // Reset submit button
        const submitButton = document.querySelector('#locationForm button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-save mr-2"></i>Simpan Lokasi';
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loadingOverlay');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    editLocation(locationId) {
        const location = this.locations.find(loc => loc.id === locationId);
        if (!location) {
            this.showToast('error', 'Error', 'Lokasi tidak ditemukan');
            return;
        }

        this.editMode = true;
        this.editingLocationId = locationId;
        this.selectedCoords = location.coordinates;

        // FIXED: Clear any existing temp marker before setting edit mode
        this.clearTempMarker();

        // Populate form
        document.getElementById('locationName').value = location.name || '';
        document.getElementById('locationCategory').value = location.category || 'poi';
        document.getElementById('locationDescription').value = location.description || '';
        document.getElementById('locationAddress').value = location.address || '';

        // Update coordinate display
        const coordsElement = document.getElementById('locationCoords');
        if (coordsElement && location.coordinates && location.coordinates.coordinates) {
            const coords = location.coordinates.coordinates; // [lng, lat]
            coordsElement.value = `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
        }

        // Update form title
        const formTitle = document.querySelector('#locations-tab h3');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-edit mr-2"></i>Edit Lokasi';
        }

        // Update submit button
        const submitButton = document.querySelector('#locationForm button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-save mr-2"></i>Perbarui Lokasi';
        }

        // Switch to locations tab
        document.querySelector('[data-tab="locations"]')?.click();

        // Zoom to location on map
        if (this.mapManager) {
            this.mapManager.zoomToLocation(locationId);
        }
    }

    async deleteLocation(locationId) {
        if (!confirm('Apakah Anda yakin ingin menghapus lokasi ini?')) {
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await this.storage.deleteLocation(locationId);
            
            if (response.success) {
                this.showToast('success', 'Berhasil', 'Lokasi berhasil dihapus');
                
                // Reload locations
                await this.loadLocations();
                
                // Remove marker from map
                if (this.mapManager) {
                    this.mapManager.removeMarker(locationId);
                }
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

    // Modal functions
    showLocationModal(locationId) {
        const location = this.locations.find(loc => loc.id === locationId);
        if (!location) {
            this.showToast('error', 'Error', 'Lokasi tidak ditemukan');
            return;
        }

        const modal = document.getElementById('locationModal');
        const modalTitle = document.getElementById('locationModalTitle');
        const modalContent = document.getElementById('locationModalContent');

        if (!modal || !modalTitle || !modalContent) {
            console.error('Modal elements not found');
            return;
        }

        modalTitle.textContent = location.name || 'Detail Lokasi';
        
        const coords = location.coordinates ? location.coordinates.coordinates : [0, 0];
        
        modalContent.innerHTML = `
            <div style="space-y-4;">
                <div>
                    <strong>Nama:</strong> ${this.escapeHtml(location.name || 'Unknown')}
                </div>
                <div>
                    <strong>Kategori:</strong> ${location.category || 'other'}
                </div>
                ${location.description ? `
                    <div>
                        <strong>Deskripsi:</strong> ${this.escapeHtml(location.description)}
                    </div>
                ` : ''}
                ${location.address ? `
                    <div>
                        <strong>Alamat:</strong> ${this.escapeHtml(location.address)}
                    </div>
                ` : ''}
                <div>
                    <strong>Koordinat:</strong> ${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}
                </div>
                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button onclick="window.zoomToLocation('${location.id}')" style="padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-search"></i> Zoom
                    </button>
                    <button onclick="window.editLocation('${location.id}')" style="padding: 8px 12px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    closeLocationModal() {
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// Initialize app when DOM is ready
let app;

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing GIS Apps...');
        app = new GISApps();
        window.app = app;
        console.log('GIS Apps initialized successfully');
        
        // Add global error handler
        window.addEventListener('error', function(e) {
            console.error('Global error:', e.error);
        });
        
        // Add unhandled promise rejection handler
        window.addEventListener('unhandledrejection', function(e) {
            console.error('Unhandled promise rejection:', e.reason);
        });
        
    } catch (error) {
        console.error('Error initializing GIS Apps:', error);
        // Show user-friendly error message
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: Arial, sans-serif;">
                <div style="text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: white;">
                    <h2 style="color: #ef4444; margin-bottom: 16px;">Application Error</h2>
                    <p style="color: #666; margin-bottom: 16px;">Failed to initialize GIS application.</p>
                    <button onclick="location.reload()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Reload Page
                    </button>
                </div>
            </div>
        `;
    }
});

// Global functions for onclick handlers
window.zoomToLocation = function(locationId) {
    if (window.app) {
        window.app.zoomToLocation(locationId);
    }
};

window.editLocation = function(locationId) {
    if (window.app) {
        window.app.editLocation(locationId);
    }
};

window.deleteLocation = function(locationId) {
    if (window.app) {
        window.app.deleteLocation(locationId);
    }
};

window.closeLocationModal = function() {
    if (window.app) {
        window.app.closeLocationModal();
    } else {
        // Fallback if app not initialized
        const modal = document.getElementById('locationModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
};
