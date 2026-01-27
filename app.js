class PKVBelegeApp {
    constructor() {
        this.belege = JSON.parse(localStorage.getItem('pkv-belege') || '[]');
        this.einstellungen = JSON.parse(localStorage.getItem('pkv-einstellungen') || '{}');
        this.aktuellesJahr = new Date().getFullYear();
        this.editingId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadEinstellungen();
        this.loadJahresauswahl();
        this.updateUI();
        this.updateBackupInfo();
        this.registerServiceWorker();
    }

    setupEventListeners() {
        // Einstellungen
        document.getElementById('selbstbeteiligung').addEventListener('input', () => this.saveEinstellungen());
        document.getElementById('beitragsrueckerstattung').addEventListener('input', () => this.saveEinstellungen());
        
        // Jahr Selection
        document.getElementById('jahresauswahl').addEventListener('change', (e) => {
            this.aktuellesJahr = parseInt(e.target.value);
            this.updateUI();
        });

        // Beleg Form
        document.getElementById('beleg-form').addEventListener('submit', (e) => this.handleBelegSubmit(e));
        document.getElementById('beleg-cancel').addEventListener('click', () => this.cancelEdit());
        
        // Modal
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('edit-cancel').addEventListener('click', () => this.closeModal());
        document.getElementById('edit-form').addEventListener('submit', (e) => this.handleEditSubmit(e));
        
        // Modal außerhalb klicken
        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('edit-modal')) {
                this.closeModal();
            }
        });

        // Import/Export Event Listeners
        document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('select-import-file').addEventListener('click', () => this.selectImportFile());
        document.getElementById('import-file').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('confirm-import').addEventListener('click', () => this.confirmImport());
        document.getElementById('cancel-import').addEventListener('click', () => this.cancelImport());

        // Heute als Standard-Datum setzen
        document.getElementById('beleg-datum').valueAsDate = new Date();
    }

    loadEinstellungen() {
        document.getElementById('selbstbeteiligung').value = this.einstellungen.selbstbeteiligung || '';
        document.getElementById('beitragsrueckerstattung').value = this.einstellungen.beitragsrueckerstattung || '';
    }

    loadJahresauswahl() {
        const select = document.getElementById('jahresauswahl');
        const currentYear = new Date().getFullYear();
        
        // Jahre von 2020 bis aktuelles Jahr + 2
        select.innerHTML = '';
        for (let year = 2020; year <= currentYear + 2; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            select.appendChild(option);
        }
        
        this.aktuellesJahr = currentYear;
    }

    saveEinstellungen() {
        this.einstellungen = {
            selbstbeteiligung: parseFloat(document.getElementById('selbstbeteiligung').value) || 0,
            beitragsrueckerstattung: parseFloat(document.getElementById('beitragsrueckerstattung').value) || 0
        };
        localStorage.setItem('pkv-einstellungen', JSON.stringify(this.einstellungen));
        this.updateUI();
    }

    handleBelegSubmit(e) {
        e.preventDefault();
        
        const datum = document.getElementById('beleg-datum').value;
        const beschreibung = document.getElementById('beleg-beschreibung').value.trim();
        const betrag = parseFloat(document.getElementById('beleg-betrag').value);

        if (!datum || !beschreibung || !betrag) {
            alert('Bitte alle Felder ausfüllen.');
            return;
        }

        if (this.editingId !== null) {
            // Bearbeiten
            const index = this.belege.findIndex(b => b.id === this.editingId);
            if (index !== -1) {
                this.belege[index] = {
                    ...this.belege[index],
                    datum,
                    beschreibung,
                    betrag
                };
            }
            this.editingId = null;
            document.getElementById('beleg-cancel').style.display = 'none';
        } else {
            // Neu hinzufügen
            const beleg = {
                id: Date.now(),
                datum,
                beschreibung,
                betrag,
                erfasst: new Date().toISOString()
            };
            this.belege.push(beleg);
        }

        this.saveBelege();
        this.resetForm();
        this.updateUI();
    }

    handleEditSubmit(e) {
        e.preventDefault();
        
        const id = parseInt(document.getElementById('edit-id').value);
        const datum = document.getElementById('edit-datum').value;
        const beschreibung = document.getElementById('edit-beschreibung').value.trim();
        const betrag = parseFloat(document.getElementById('edit-betrag').value);

        const index = this.belege.findIndex(b => b.id === id);
        if (index !== -1) {
            this.belege[index] = {
                ...this.belege[index],
                datum,
                beschreibung,
                betrag
            };
            this.saveBelege();
            this.updateUI();
            this.closeModal();
        }
    }

    editBeleg(id) {
        const beleg = this.belege.find(b => b.id === id);
        if (beleg) {
            document.getElementById('edit-id').value = id;
            document.getElementById('edit-datum').value = beleg.datum;
            document.getElementById('edit-beschreibung').value = beleg.beschreibung;
            document.getElementById('edit-betrag').value = beleg.betrag;
            document.getElementById('edit-modal').style.display = 'block';
        }
    }

    deleteBeleg(id) {
        if (confirm('Beleg wirklich löschen?')) {
            this.belege = this.belege.filter(b => b.id !== id);
            this.saveBelege();
            this.updateUI();
        }
    }

    cancelEdit() {
        this.editingId = null;
        this.resetForm();
        document.getElementById('beleg-cancel').style.display = 'none';
    }

    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }

    resetForm() {
        document.getElementById('beleg-form').reset();
        document.getElementById('beleg-datum').valueAsDate = new Date();
    }

    saveBelege() {
        localStorage.setItem('pkv-belege', JSON.stringify(this.belege));
    }

    getBelegeForYear(year) {
        return this.belege.filter(beleg => {
            const belegJahr = new Date(beleg.datum).getFullYear();
            return belegJahr === year;
        });
    }

    updateUI() {
        this.updateOverview();
        this.updateBelegeList();
        document.getElementById('belege-jahr').textContent = this.aktuellesJahr;
    }

    updateOverview() {
        const jahresBelege = this.getBelegeForYear(this.aktuellesJahr);
        const gesamtbetrag = jahresBelege.reduce((sum, beleg) => sum + beleg.betrag, 0);
        const selbstbeteiligung = this.einstellungen.selbstbeteiligung || 0;
        const beitragsrueckerstattung = this.einstellungen.beitragsrueckerstattung || 0;
        
        const mindestbetrag = Math.max(selbstbeteiligung, beitragsrueckerstattung);
        const nochBisEinreichung = Math.max(0, mindestbetrag - gesamtbetrag);
        const lohntSich = gesamtbetrag >= mindestbetrag && mindestbetrag > 0;

        document.getElementById('gesamtbetrag').textContent = this.formatCurrency(gesamtbetrag);
        document.getElementById('noch-bis-einreichung').textContent = this.formatCurrency(nochBisEinreichung);
        
        const statusCard = document.getElementById('einreichung-status');
        const statusText = document.getElementById('status-text');
        
        if (lohntSich) {
            statusCard.classList.add('active');
            statusText.textContent = 'Einreichung lohnt sich!';
        } else {
            statusCard.classList.remove('active');
            statusText.textContent = nochBisEinreichung > 0 ? 'Noch nicht lohnend' : 'Mindestbetrag erreicht';
        }
    }

    updateBelegeList() {
        const liste = document.getElementById('belege-liste');
        const jahresBelege = this.getBelegeForYear(this.aktuellesJahr);
        
        if (jahresBelege.length === 0) {
            liste.innerHTML = `
                <div class="empty-state">
                    <h3>Keine Belege für ${this.aktuellesJahr}</h3>
                    <p>Fügen Sie Ihren ersten Beleg hinzu, um zu beginnen.</p>
                </div>
            `;
            return;
        }

        // Sortiere nach Datum (neueste zuerst)
        jahresBelege.sort((a, b) => new Date(b.datum) - new Date(a.datum));

        liste.innerHTML = jahresBelege.map(beleg => `
            <div class="beleg-item">
                <div class="beleg-datum">${this.formatDate(beleg.datum)}</div>
                <div class="beleg-beschreibung">${beleg.beschreibung}</div>
                <div class="beleg-betrag">${this.formatCurrency(beleg.betrag)}</div>
                <div class="beleg-actions">
                    <button class="edit-btn" onclick="app.editBeleg(${beleg.id})">✏️</button>
                    <button class="delete-btn" onclick="app.deleteBeleg(${beleg.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    // Export-Funktion
    exportJSON() {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            belege: this.belege,
            einstellungen: this.einstellungen,
            appInfo: {
                name: 'PKV Belege',
                version: '1.0'
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const filename = `pkv-belege-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.saveLastBackup();
        this.showMessage('Backup erfolgreich erstellt! 💾', 'success');
    }

    // Import-Funktionen
    selectImportFile() {
        document.getElementById('import-file').click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileInfo = document.getElementById('import-file-info');
        const importOptions = document.getElementById('import-options');

        if (file.type === 'application/json' || file.name.endsWith('.json')) {
            fileInfo.innerHTML = `
                <strong>📋 ${file.name}</strong><br>
                <small>JSON-Backup (${this.formatFileSize(file.size)})</small>
            `;
            fileInfo.classList.add('has-file');
            importOptions.style.display = 'block';
        } else {
            fileInfo.innerHTML = `
                <span style="color: var(--danger-color);">
                    ❌ Ungültiges Dateiformat<br>
                    <small>Nur JSON-Dateien werden unterstützt</small>
                </span>
            `;
            fileInfo.classList.remove('has-file');
            importOptions.style.display = 'none';
        }
    }

    async confirmImport() {
        const file = document.getElementById('import-file').files[0];
        const importMode = document.querySelector('input[name="import-mode"]:checked').value;

        if (!file) {
            this.showMessage('Bitte wählen Sie eine Backup-Datei aus.', 'error');
            return;
        }

        try {
            await this.importJSON(file, importMode);
        } catch (error) {
            console.error('Import-Fehler:', error);
            this.showMessage('Fehler beim Wiederherstellen des Backups. Überprüfen Sie die Datei.', 'error');
        }
    }

    async importJSON(file, mode) {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.belege || !Array.isArray(data.belege)) {
            throw new Error('Ungültiges Backup-Format');
        }

        let importedCount = 0;
        let updatedCount = 0;
        const existingIds = new Set(this.belege.map(b => b.id));

        switch (mode) {
            case 'replace':
                this.belege = data.belege.map(beleg => ({
                    ...beleg,
                    id: beleg.id || Date.now() + Math.random()
                }));
                if (data.einstellungen) {
                    this.einstellungen = data.einstellungen;
                    this.loadEinstellungen();
                }
                importedCount = this.belege.length;
                this.showMessage(`Backup vollständig wiederhergestellt! ${importedCount} Belege geladen.`, 'success');
                break;

            case 'merge':
                // Bestehende Belege mit gleicher ID ersetzen, neue hinzufügen
                data.belege.forEach(beleg => {
                    const id = beleg.id || Date.now() + Math.random();
                    const existingIndex = this.belege.findIndex(b => b.id === id);
                    
                    if (existingIndex !== -1) {
                        this.belege[existingIndex] = { ...beleg, id };
                        updatedCount++;
                    } else {
                        this.belege.push({ ...beleg, id });
                        importedCount++;
                    }
                });
                
                if (data.einstellungen) {
                    this.einstellungen = { ...this.einstellungen, ...data.einstellungen };
                    this.loadEinstellungen();
                }
                
                this.showMessage(`Daten zusammengeführt! ${importedCount} neue Belege, ${updatedCount} aktualisiert.`, 'success');
                break;

            case 'add':
                data.belege.forEach(beleg => {
                    const id = Date.now() + Math.random();
                    if (!existingIds.has(beleg.id)) {
                        this.belege.push({ ...beleg, id });
                        importedCount++;
                    }
                });
                this.showMessage(`${importedCount} neue Belege hinzugefügt.`, 'success');
                break;
        }

        this.saveBelege();
        this.updateUI();
        this.cancelImport();
    }

    cancelImport() {
        document.getElementById('import-file').value = '';
        document.getElementById('import-file-info').innerHTML = 'Keine Datei ausgewählt';
        document.getElementById('import-file-info').classList.remove('has-file');
        document.getElementById('import-options').style.display = 'none';
        
        // Erste Option wieder auswählen
        document.querySelector('input[value="replace"]').checked = true;
    }

    // Hilfsfunktionen
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    saveLastBackup() {
        localStorage.setItem('pkv-last-backup', new Date().toISOString());
        this.updateBackupInfo();
    }

    updateBackupInfo() {
        const lastBackup = localStorage.getItem('pkv-last-backup');
        const backupInfo = document.getElementById('last-backup-info');
        
        if (lastBackup) {
            const date = new Date(lastBackup);
            const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
            
            let timeText = '';
            if (daysAgo === 0) {
                timeText = 'heute';
            } else if (daysAgo === 1) {
                timeText = 'gestern';
            } else {
                timeText = `vor ${daysAgo} Tagen`;
            }
            
            backupInfo.innerHTML = `
                Letztes Backup: ${date.toLocaleDateString('de-DE')} (${timeText})
            `;
        } else {
            backupInfo.innerHTML = 'Noch kein Backup erstellt';
        }
    }

    showMessage(text, type = 'info') {
        // Entferne alte Nachrichten
        const oldMessages = document.querySelectorAll('.message');
        oldMessages.forEach(msg => msg.remove());

        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;

        // Füge nach der Import/Export-Section ein
        const importExportSection = document.querySelector('.import-export-section');
        importExportSection.insertAdjacentElement('afterend', message);

        // Automatisch nach 4 Sekunden ausblenden
        setTimeout(() => {
            message.style.transition = 'opacity 0.3s ease';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 4000);
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    formatDate(dateString) {
        return new Intl.DateTimeFormat('de-DE').format(new Date(dateString));
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registriert');
            } catch (error) {
                console.log('Service Worker Registrierung fehlgeschlagen:', error);
            }
        }
    }
}

// App initialisieren
const app = new PKVBelegeApp();