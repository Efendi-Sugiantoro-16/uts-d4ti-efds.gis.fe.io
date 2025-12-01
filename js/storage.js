// Hybrid Storage Manager - LocalStorage + Backend API
class StorageManager {
    constructor(apiBase) {
        this.apiBase = apiBase;
        this.storageKey = 'gis_apps_locations';
        this.pendingSyncKey = 'gis_apps_pending_sync';
        this.isBackendAvailable = true;
        this.pendingSync = [];
        
        // Initialize storage
        this.init();
        
        // Check backend connection asynchronously
        this.checkBackendConnection();
    }

    // Initialize
    init() {
        this.pendingSync = this.loadPendingSync();
        
        // Try to sync pending operations every 30 seconds
        setInterval(() => {
            this.checkBackendConnection().then(available => {
                if (available && this.pendingSync.length > 0) {
                    this.syncPendingOperations();
                }
            });
        }, 30000);
    }

    // Check if backend is available
    async checkBackendConnection() {
        try {
            // FIXED: For GitHub Pages, always use localStorage (no backend)
            if (window.location.hostname !== 'localhost') {
                this.isBackendAvailable = false;
                console.log('GitHub Pages detected - using localStorage only');
                return false;
            }
            
            // Health endpoint is at /health, not /api/health
            const baseUrl = this.apiBase.replace('/api', '');
            const response = await fetch(`${baseUrl}/health`);
            this.isBackendAvailable = response.ok;
            console.log('Backend health check:', this.isBackendAvailable ? 'Available' : 'Not available');
            return this.isBackendAvailable;
        } catch (error) {
            this.isBackendAvailable = false;
            console.log('Backend health check failed:', error.message);
            return false;
        }
    }

    // Get all locations (localStorage + backend)
    async getLocations() {
        const localLocations = this.getLocalLocations();
        
        if (this.isBackendAvailable) {
            try {
                const response = await fetch(`${this.apiBase}/locations`);
                if (response.ok) {
                    const backendData = await response.json();
                    if (backendData.success && backendData.data) {
                        // Sync backend data to localStorage
                        this.setLocalLocations(backendData.data);
                        return backendData.data;
                    }
                }
            } catch (error) {
                console.warn('Backend unavailable, using localStorage:', error);
                this.isBackendAvailable = false;
            }
        }
        
        return localLocations;
    }

    // Create location (localStorage + backend)
    async createLocation(locationData) {
        const location = {
            id: this.generateId(),
            ...locationData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            source: 'local'
        };

        // FIXED: Ensure coordinates are in correct GeoJSON format [lng, lat]
        if (!locationData.coordinates || !locationData.coordinates.coordinates) {
            console.warn('No coordinates provided, using default Jakarta coordinates');
            location.coordinates = {
                type: 'Point',
                coordinates: [106.819561, -6.218561] // Default Jakarta: [lng, lat]
            };
        } else {
            // FIXED: Validate coordinate format [lng, lat]
            const coords = locationData.coordinates.coordinates;
            if (!Array.isArray(coords) || coords.length !== 2) {
                console.error('Invalid coordinate format:', coords);
                location.coordinates = {
                    type: 'Point',
                    coordinates: [106.819561, -6.218561] // Fallback to Jakarta
                };
            }
            
            // FIXED: Validate coordinate values
            const [lng, lat] = coords;
            if (typeof lng !== 'number' || typeof lat !== 'number' ||
                isNaN(lng) || isNaN(lat) ||
                lng < -180 || lng > 180 ||
                lat < -90 || lat > 90) {
                console.error('Invalid coordinate values:', coords);
                location.coordinates = {
                    type: 'Point',
                    coordinates: [106.819561, -6.218561] // Fallback to Jakarta
                };
            } else {
                // FIXED: Ensure proper GeoJSON format
                location.coordinates = {
                    type: 'Point',
                    coordinates: [lng, lat] // [lng, lat]
                };
            }
        }

        // Save to localStorage immediately
        const locations = this.getLocalLocations();
        locations.push(location);
        this.setLocalLocations(locations);

        console.log('Location saved to localStorage:', location);

        // Try to sync with backend
        if (this.isBackendAvailable) {
            try {
                // Send original locationData to backend, not the processed location
                const response = await fetch(`${this.apiBase}/locations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(location)
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // Update with backend ID and mark as synced
                        location.id = result.data.id;
                        location.source = 'backend';
                        this.updateLocalLocation(location);
                        return { success: true, data: location, synced: true };
                    }
                }
            } catch (error) {
                console.warn('Backend sync failed, keeping in localStorage:', error);
                this.isBackendAvailable = false;
                this.addToPendingSync('create', location);
            }
        } else {
            this.addToPendingSync('create', location);
        }

        return { success: true, data: location, synced: false };
    }

    // Update location (localStorage + backend)
    async updateLocation(id, locationData) {
        const locations = this.getLocalLocations();
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index === -1) {
            return { success: false, error: 'Location not found' };
        }

        const updatedLocation = {
            ...locations[index],
            ...locationData,
            updated_at: new Date().toISOString()
        };

        // FIXED: Validate coordinates if provided in update
        if (locationData.coordinates) {
            if (!locationData.coordinates.coordinates) {
                console.warn('No coordinates provided in update, keeping existing coordinates');
                // Keep existing coordinates
                updatedLocation.coordinates = locations[index].coordinates;
            } else {
                // FIXED: Validate coordinate format [lng, lat]
                const coords = locationData.coordinates.coordinates;
                if (!Array.isArray(coords) || coords.length !== 2) {
                    console.error('Invalid coordinate format in update:', coords);
                    // Keep existing coordinates
                    updatedLocation.coordinates = locations[index].coordinates;
                } else {
                    // FIXED: Validate coordinate values
                    const [lng, lat] = coords;
                    if (typeof lng !== 'number' || typeof lat !== 'number' ||
                        isNaN(lng) || isNaN(lat) ||
                        lng < -180 || lng > 180 ||
                        lat < -90 || lat > 90) {
                        console.error('Invalid coordinate values in update:', coords);
                        // Keep existing coordinates
                        updatedLocation.coordinates = locations[index].coordinates;
                    } else {
                        // FIXED: Ensure proper GeoJSON format
                        updatedLocation.coordinates = {
                            type: 'Point',
                            coordinates: [lng, lat] // [lng, lat]
                        };
                    }
                }
            }
        }

        // Update localStorage immediately
        locations[index] = updatedLocation;
        this.setLocalLocations(locations);

        // Try to sync with backend
        if (this.isBackendAvailable) {
            try {
                // Send updatedLocation to backend
                const response = await fetch(`${this.apiBase}/locations/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedLocation)
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        updatedLocation.source = 'backend';
                        this.updateLocalLocation(updatedLocation);
                        return { success: true, data: updatedLocation, synced: true };
                    }
                }
            } catch (error) {
                console.warn('Backend sync failed, keeping in localStorage:', error);
                this.isBackendAvailable = false;
                this.addToPendingSync('update', updatedLocation);
            }
        } else {
            this.addToPendingSync('update', updatedLocation);
        }

        return { success: true, data: updatedLocation, synced: false };
    }

    // Delete location (localStorage + backend)
    async deleteLocation(id) {
        const locations = this.getLocalLocations();
        const index = locations.findIndex(loc => loc.id === id);
        
        if (index === -1) {
            return { success: false, error: 'Location not found' };
        }

        const deletedLocation = locations[index];

        // Delete from localStorage immediately
        locations.splice(index, 1);
        this.setLocalLocations(locations);

        // Try to sync with backend
        if (this.isBackendAvailable) {
            try {
                const response = await fetch(`${this.apiBase}/locations/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        return { success: true, synced: true };
                    }
                }
            } catch (error) {
                console.warn('Backend sync failed, keeping deleted in localStorage:', error);
                this.isBackendAvailable = false;
                this.addToPendingSync('delete', { id });
            }
        } else {
            this.addToPendingSync('delete', { id });
        }

        return { success: true, synced: false };
    }

    // Sync pending operations when backend becomes available
    async syncPendingOperations() {
        if (!this.isBackendAvailable || this.pendingSync.length === 0) {
            return;
        }

        console.log(`Starting sync for ${this.pendingSync.length} operations`);

        const syncedOperations = [];
        
        for (const operation of this.pendingSync) {
            try {
                let success = false;
                
                switch (operation.type) {
                    case 'create':
                        // Extract only the fields that backend expects
                        const createData = {
                            name: operation.data.name,
                            category: operation.data.category,
                            description: operation.data.description || '',
                            address: operation.data.address || '',
                            coordinates: operation.data.coordinates
                        };
                        
                        console.log('Syncing create operation:', createData);
                        
                        // Validate coordinates format
                        if (!createData.coordinates || !createData.coordinates.coordinates || !Array.isArray(createData.coordinates.coordinates)) {
                            console.error('Invalid coordinates format:', createData.coordinates);
                            syncedOperations.push(operation); // Remove invalid operation
                            continue;
                        }
                        
                        const createResponse = await fetch(`${this.apiBase}/locations`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(createData)
                        });
                        
                        console.log('Create response status:', createResponse.status);
                        
                        if (createResponse.ok) {
                            const result = await createResponse.json();
                            console.log('Create response data:', result);
                            if (result.success) {
                                // Update local data with backend ID
                                operation.data.id = result.data.id;
                                operation.data.source = 'backend';
                                this.updateLocalLocation(operation.data);
                                success = true;
                            }
                        } else {
                            const errorText = await createResponse.text();
                            console.error('Create failed:', createResponse.status, errorText);
                            // If coordinates are required error, remove this operation
                            if (errorText.includes('Coordinates are required')) {
                                console.warn('Removing invalid operation due to coordinates error');
                                syncedOperations.push(operation);
                            }
                        }
                        break;
                        
                    case 'update':
                        // Extract only the fields that backend expects
                        const updateData = {
                            name: operation.data.name,
                            category: operation.data.category,
                            description: operation.data.description || '',
                            address: operation.data.address || '',
                            coordinates: operation.data.coordinates
                        };
                        
                        console.log('Syncing update operation:', operation.data.id, updateData);
                        
                        // Validate coordinates format
                        if (!updateData.coordinates || !updateData.coordinates.coordinates || !Array.isArray(updateData.coordinates.coordinates)) {
                            console.error('Invalid coordinates format for update:', updateData.coordinates);
                            syncedOperations.push(operation); // Remove invalid operation
                            continue;
                        }
                        
                        const updateResponse = await fetch(`${this.apiBase}/locations/${operation.data.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updateData)
                        });
                        
                        console.log('Update response status:', updateResponse.status);
                        
                        if (updateResponse.ok) {
                            const result = await updateResponse.json();
                            console.log('Update response data:', result);
                            if (result.success) {
                                operation.data.source = 'backend';
                                this.updateLocalLocation(operation.data);
                                success = true;
                            }
                        } else {
                            const errorText = await updateResponse.text();
                            console.error('Update failed:', updateResponse.status, errorText);
                            // If coordinates are required error, remove this operation
                            if (errorText.includes('Coordinates are required')) {
                                console.warn('Removing invalid operation due to coordinates error');
                                syncedOperations.push(operation);
                            }
                        }
                        break;
                        
                    case 'delete':
                        const deleteResponse = await fetch(`${this.apiBase}/locations/${operation.data.id}`, {
                            method: 'DELETE'
                        });
                        if (deleteResponse.ok) {
                            const result = await deleteResponse.json();
                            if (result.success) {
                                success = true;
                            }
                        } else {
                            const errorText = await deleteResponse.text();
                            console.error('Delete failed:', deleteResponse.status, errorText);
                        }
                        break;
                }
                
                if (success) {
                    syncedOperations.push(operation);
                }
            } catch (error) {
                console.warn('Failed to sync operation:', operation, error);
            }
        }
        
        // Remove synced operations from pending list
        this.pendingSync = this.pendingSync.filter(op => !syncedOperations.includes(op));
        this.savePendingSync();
        
        console.log(`Synced ${syncedOperations.length} operations to backend, ${this.pendingSync.length} remaining`);
    }

    // LocalStorage helper methods
    getLocalLocations() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return [];
        }
    }

    setLocalLocations(locations) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(locations));
        } catch (error) {
            console.error('Error writing to localStorage:', error);
        }
    }

    updateLocalLocation(updatedLocation) {
        const locations = this.getLocalLocations();
        const index = locations.findIndex(loc => loc.id === updatedLocation.id);
        if (index !== -1) {
            locations[index] = updatedLocation;
            this.setLocalLocations(locations);
        }
    }

    addToPendingSync(type, data) {
        this.pendingSync.push({
            type,
            data,
            timestamp: new Date().toISOString()
        });
        this.savePendingSync();
    }

    savePendingSync() {
        try {
            localStorage.setItem('gis_apps_pending_sync', JSON.stringify(this.pendingSync));
        } catch (error) {
            console.error('Error saving pending sync:', error);
        }
    }

    loadPendingSync() {
        try {
            const data = localStorage.getItem('gis_apps_pending_sync');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading pending sync:', error);
            return [];
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Get storage status
    getStorageStatus() {
        return {
            backendAvailable: this.isBackendAvailable,
            localCount: this.getLocalLocations().length,
            pendingSync: this.pendingSync.length
        };
    }

    // Clear all local data
    clearLocalData() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('gis_apps_pending_sync');
        this.pendingSync = [];
    }

    // Initialize
    init() {
        this.pendingSync = this.loadPendingSync();
        
        // Try to sync pending operations every 30 seconds
        setInterval(() => {
            this.checkBackendConnection().then(available => {
                if (available && this.pendingSync.length > 0) {
                    this.syncPendingOperations();
                }
            });
        }, 30000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
