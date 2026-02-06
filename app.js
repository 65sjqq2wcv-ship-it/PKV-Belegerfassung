class PKVBelegeApp {
    constructor() {
        this.currentVersion = '1.18';
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
        this.checkForUpdates();
        this.registerServiceWorker();
    }

    setupEventListeners() {
        // Währungseingabe Setup für Einstellungen
        this.setupCurrencyInput('selbstbeteiligung');
        this.setupCurrencyInput('beitragsrueckerstattung');

        // Jahr Selection
        document.getElementById('jahresauswahl').addEventListener('change', (e) => {
            this.aktuellesJahr = parseInt(e.target.value);
            this.updateUI();
        });

        // Event-Delegation für Beleg-Buttons
        document.getElementById('belege-liste').addEventListener('click', (e) => {
            const target = e.target;
            const action = target.getAttribute('data-action');
            const id = parseInt(target.getAttribute('data-id'));

            if (action === 'edit' && id) {
                this.editBeleg(id);
            } else if (action === 'delete' && id) {
                this.deleteBeleg(id);
            }
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

        // Backup Icon und Modal Event Listeners
        document.getElementById('backup-icon').addEventListener('click', () => this.openBackupModal());
        document.getElementById('backup-modal-close').addEventListener('click', () => this.closeBackupModal());
        document.getElementById('backup-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('backup-modal')) {
                this.closeBackupModal();
            }
        });

        // Import/Export Event Listeners im Backup Modal
        document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('select-import-file').addEventListener('click', () => this.selectImportFile());
        document.getElementById('import-file').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('confirm-import').addEventListener('click', () => this.confirmImport());
        document.getElementById('cancel-import').addEventListener('click', () => this.cancelImport());

        // Heute als Standard-Datum setzen
        document.getElementById('beleg-datum').valueAsDate = new Date();
    }

    // Währungsformatierung Methoden
    setupCurrencyInput(inputId) {
        const input = document.getElementById(inputId);
        let isBlurring = false;

        input.addEventListener('focus', (e) => {
            // Beim Focus: Nur die Zahl zeigen ohne €
            const currentValue = e.target.value;
            if (currentValue.includes('€')) {
                const numberValue = parseFloat(currentValue.replace(/[€\s.]/g, '').replace(',', '.')) || 0;
                if (numberValue > 0) {
                    e.target.value = numberValue.toString().replace('.', ',');
                } else {
                    e.target.value = '';
                }
            }
        });

        input.addEventListener('blur', (e) => {
            if (isBlurring) return;
            isBlurring = true;

            const inputValue = e.target.value.trim();
            let numberValue = 0;

            if (inputValue && inputValue !== '') {
                // Einfache Konvertierung: Komma durch Punkt ersetzen
                const cleanValue = inputValue.replace(',', '.');
                numberValue = parseFloat(cleanValue) || 0;
            }

            // Formatierte Anzeige setzen
            if (numberValue > 0) {
                e.target.value = new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(numberValue);
            } else {
                e.target.value = '';
            }

            // Direkt speichern
            this.saveCurrencyValue(inputId, numberValue);

            setTimeout(() => { isBlurring = false; }, 100);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });

        // Nur Zahlen und Komma erlauben
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            const cleanValue = value.replace(/[^0-9,]/g, '');
            if (value !== cleanValue) {
                e.target.value = cleanValue;
            }
        });
    }

    saveCurrencyValue(inputId, value) {
        if (inputId === 'selbstbeteiligung') {
            this.einstellungen.selbstbeteiligung = value;
        } else if (inputId === 'beitragsrueckerstattung') {
            this.einstellungen.beitragsrueckerstattung = value;
        }

        localStorage.setItem('pkv-einstellungen', JSON.stringify(this.einstellungen));
        this.updateOverview();
    }

    // Update Check System
    async checkForUpdates() {
        const lastVersion = localStorage.getItem('pkv-app-version');
        const lastCheck = localStorage.getItem('pkv-last-update-check');
        const now = new Date().toISOString().split('T')[0];

        if (lastVersion !== this.currentVersion || lastCheck !== now) {
            try {
                const isNewVersion = lastVersion && lastVersion !== this.currentVersion;

                if (isNewVersion) {
                    this.showUpdateBanner();
                }

                localStorage.setItem('pkv-app-version', this.currentVersion);
                localStorage.setItem('pkv-last-update-check', now);
            } catch (error) {
                console.log('Update-Check fehlgeschlagen:', error);
            }
        }
    }

    showUpdateBanner() {
        const banner = document.createElement('div');
        banner.className = 'update-banner';
        banner.innerHTML = `
            <div>📱 App wurde aktualisiert! Neue Funktionen verfügbar.</div>
            <button onclick="app.hideUpdateBanner()">OK</button>
            <button onclick="app.reloadApp()">Neu laden</button>
        `;

        document.body.appendChild(banner);

        setTimeout(() => {
            banner.classList.add('show');
        }, 1000);

        setTimeout(() => {
            this.hideUpdateBanner();
        }, 10000);
    }

    hideUpdateBanner() {
        const banner = document.querySelector('.update-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
    }

    reloadApp() {
        window.location.reload();
    }

    // Backup Modal Methoden
    openBackupModal() {
        document.getElementById('backup-modal').style.display = 'block';
        this.updateBackupInfo();
    }

    closeBackupModal() {
        document.getElementById('backup-modal').style.display = 'none';
        this.cancelImport();
    }

    loadEinstellungen() {
        const selbstbeteiligung = this.einstellungen.selbstbeteiligung || 0;
        const beitragsrueckerstattung = this.einstellungen.beitragsrueckerstattung || 0;

        const selbstInput = document.getElementById('selbstbeteiligung');
        const beitragsInput = document.getElementById('beitragsrueckerstattung');

        if (document.activeElement !== selbstInput) {
            selbstInput.value = selbstbeteiligung > 0 ?
                new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(selbstbeteiligung) : '';
        }

        if (document.activeElement !== beitragsInput) {
            beitragsInput.value = beitragsrueckerstattung > 0 ?
                new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(beitragsrueckerstattung) : '';
        }
    }

    loadJahresauswahl() {
        const select = document.getElementById('jahresauswahl');
        const currentYear = new Date().getFullYear();

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
        this.updateUI();
    }

    handleBelegSubmit(e) {
        e.preventDefault();

        const datum = document.getElementById('beleg-datum').value;
        const beschreibung = document.getElementById('beleg-beschreibung').value.trim();
        const betrag = parseFloat(document.getElementById('beleg-betrag').value);

        if (!datum || !beschreibung || !betrag) {
            this.showMessage('Bitte alle Felder ausfüllen.', 'error');
            return;
        }

        if (this.editingId) {
            // Bearbeiten
            const index = this.belege.findIndex(beleg => beleg.id === this.editingId);
            if (index !== -1) {
                this.belege[index] = {
                    id: this.editingId,
                    datum,
                    beschreibung,
                    betrag
                };
                this.showMessage('Beleg erfolgreich aktualisiert!', 'success');
                this.cancelEdit();
            }
        } else {
            // Neu hinzufügen
            const neuerBeleg = {
                id: Date.now(),
                datum,
                beschreibung,
                betrag
            };
            this.belege.push(neuerBeleg);
            this.showMessage('Beleg erfolgreich hinzugefügt!', 'success');
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

        if (!datum || !beschreibung || !betrag) {
            this.showMessage('Bitte alle Felder ausfüllen.', 'error');
            return;
        }

        const index = this.belege.findIndex(beleg => beleg.id === id);
        if (index !== -1) {
            this.belege[index] = { id, datum, beschreibung, betrag };
            this.saveBelege();
            this.updateUI();
            this.closeModal();
            this.showMessage('Beleg erfolgreich bearbeitet!', 'success');
        }
    }

    editBeleg(id) {
        const beleg = this.belege.find(b => b.id === id);
        if (beleg) {
            if (window.innerWidth <= 768) {
                // Mobile: Inline-Bearbeitung
                this.editingId = id;
                document.getElementById('beleg-datum').value = beleg.datum;
                document.getElementById('beleg-beschreibung').value = beleg.beschreibung;
                document.getElementById('beleg-betrag').value = beleg.betrag;
                document.getElementById('beleg-cancel').style.display = 'inline-block';

                // Zum Formular scrollen
                document.querySelector('.add-receipt-section').scrollIntoView({
                    behavior: 'smooth'
                });
            } else {
                // Desktop: Modal
                document.getElementById('edit-id').value = beleg.id;
                document.getElementById('edit-datum').value = beleg.datum;
                document.getElementById('edit-beschreibung').value = beleg.beschreibung;
                document.getElementById('edit-betrag').value = beleg.betrag;
                document.getElementById('edit-modal').style.display = 'block';
            }
        }
    }

    deleteBeleg(id) {
        if (confirm('Sind Sie sicher, dass Sie diesen Beleg löschen möchten?')) {
            this.belege = this.belege.filter(beleg => beleg.id !== id);
            this.saveBelege();
            this.updateUI();
            this.showMessage('Beleg erfolgreich gelöscht!', 'success');
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
        this.loadEinstellungen();
        document.getElementById('belege-jahr').textContent = this.aktuellesJahr;
        const belegeJahr2 = document.getElementById('belege-jahr-2');
        if (belegeJahr2) {
            belegeJahr2.textContent = this.aktuellesJahr;
        }
    }

    updateOverview() {
        const jahresBelege = this.getBelegeForYear(this.aktuellesJahr);
        const gesamtbetrag = jahresBelege.reduce((sum, beleg) => sum + beleg.betrag, 0);
        const selbstbeteiligung = this.einstellungen.selbstbeteiligung || 0;
        const beitragsrueckerstattung = this.einstellungen.beitragsrueckerstattung || 0;

        const mindestbetrag = selbstbeteiligung + beitragsrueckerstattung;
        const nochBisEinreichung = Math.max(0, mindestbetrag - gesamtbetrag);
        const lohntSich = gesamtbetrag > mindestbetrag && gesamtbetrag > 0;

        document.getElementById('gesamtbetrag').textContent = this.formatCurrency(gesamtbetrag);
        document.getElementById('noch-bis-einreichung').textContent = this.formatCurrency(nochBisEinreichung);

        const statusCard = document.getElementById('einreichung-status');
        const statusText = document.getElementById('status-text');

        if (lohntSich) {
            statusCard.classList.add('active');
            const erstattungsbetrag = gesamtbetrag - selbstbeteiligung;
            statusText.textContent = `Einreichung lohnt sich! Erstattung: ${this.formatCurrency(erstattungsbetrag)}`;
        } else {
            statusCard.classList.remove('active');
            statusText.textContent = gesamtbetrag > 0 ? 'Noch nicht lohnend' : 'Keine Belege vorhanden';
        }
    }

    updateBelegeList() {
        const liste = document.getElementById('belege-liste');
        const jahresBelege = this.getBelegeForYear(this.aktuellesJahr);

        if (jahresBelege.length === 0) {
            liste.innerHTML = `
                <div class="empty-state">
                    <h3>Keine Belege für ${this.aktuellesJahr}</h3>
                    <p>Fügen Sie Ihren ersten Beleg hinzu.</p>
                </div>
            `;
            return;
        }

        jahresBelege.sort((a, b) => new Date(b.datum) - new Date(a.datum));

        liste.innerHTML = jahresBelege.map(beleg => `
            <div class="beleg-item" data-id="${beleg.id}">
                <div class="beleg-datum">${this.formatDate(beleg.datum)}</div>
                <div class="beleg-beschreibung">${beleg.beschreibung}</div>
                <div class="beleg-betrag">${this.formatCurrency(beleg.betrag)}</div>
                <div class="beleg-actions">
                    <button class="edit-btn" data-action="edit" data-id="${beleg.id}">✏️</button>
                    <button class="delete-btn" data-action="delete" data-id="${beleg.id}">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    exportJSON() {
        const exportData = {
            version: this.currentVersion,
            exportDate: new Date().toISOString(),
            belege: this.belege,
            einstellungen: this.einstellungen,
            appInfo: {
                name: 'PKV Belege',
                version: this.currentVersion
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

        setTimeout(() => {
            this.closeBackupModal();
        }, 1500);
    }

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
            this.showMessage('Fehler beim Wiederherstellen des Backups.', 'error');
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

                this.showMessage(`Daten zusammengeführt! ${importedCount} neue, ${updatedCount} aktualisiert.`, 'success');
                break;

            case 'add':
                const existingIds = new Set(this.belege.map(b => b.id));
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
        localStorage.setItem('pkv-einstellungen', JSON.stringify(this.einstellungen));
        this.updateUI();
        this.cancelImport();

        setTimeout(() => {
            this.closeBackupModal();
        }, 2000);
    }

    cancelImport() {
        document.getElementById('import-file').value = '';
        document.getElementById('import-file-info').innerHTML = 'Keine Datei ausgewählt';
        document.getElementById('import-file-info').classList.remove('has-file');
        document.getElementById('import-options').style.display = 'none';
        document.querySelector('input[value="replace"]').checked = true;
    }

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

            let timeText = daysAgo === 0 ? 'heute' : daysAgo === 1 ? 'gestern' : `vor ${daysAgo} Tagen`;

            backupInfo.innerHTML = `Letztes Backup: ${date.toLocaleDateString('de-DE')} (${timeText})`;
        } else {
            backupInfo.innerHTML = 'Noch kein Backup erstellt';
        }
    }

    showMessage(text, type = 'info') {
        const oldMessages = document.querySelectorAll('.message');
        oldMessages.forEach(msg => msg.remove());

        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;

        const backupModal = document.getElementById('backup-modal');
        if (backupModal.style.display === 'block') {
            const modalContent = backupModal.querySelector('.modal-content');
            modalContent.insertBefore(message, modalContent.firstChild);
        } else {
            const main = document.querySelector('main');
            main.insertBefore(message, main.firstChild);
        }

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
        return new Intl.DateTimeFormat('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        }).format(new Date(dateString));
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js');

                registration.addEventListener('updatefound', () => {
                    this.showUpdateBanner();
                });
            } catch (error) {
                console.log('Service Worker Registrierung fehlgeschlagen:', error);
            }
        }
    }
}

// App initialisieren
const app = new PKVBelegeApp();
