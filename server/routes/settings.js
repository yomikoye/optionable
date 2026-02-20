import { Router } from 'express';
import { db, dbPath } from '../db/connection.js';
import { apiResponse } from '../utils/response.js';

const router = Router();

// GET all settings
router.get('/', (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        const settingsObj = Object.fromEntries(settings.map(s => [s.key, s.value]));
        apiResponse.success(res, settingsObj);
    } catch (error) {
        console.error('Error fetching settings:', error);
        apiResponse.error(res, 'Failed to fetch settings');
    }
});

// PUT update setting
router.put('/:key', (req, res) => {
    try {
        const { value } = req.body;
        const key = req.params.key;

        db.prepare(`
            INSERT OR REPLACE INTO settings (key, value, updatedAt)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(key, value);

        apiResponse.success(res, { key, value });
    } catch (error) {
        console.error('Error updating setting:', error);
        apiResponse.error(res, 'Failed to update setting');
    }
});

// GET export database
router.get('/export-db', (req, res) => {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        const timestamp = new Date().toISOString().slice(0, 10);
        res.download(dbPath, `optionable-${timestamp}.db`);
    } catch (error) {
        console.error('Error exporting database:', error);
        apiResponse.error(res, 'Failed to export database');
    }
});

export default router;
