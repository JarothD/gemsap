const { getSettings, saveSettings } = require('../config/Data');

const obtenerFirmas = async (req, res) => {
    try {
        const { firmas, firmaSeleccionada } = getSettings();
        res.json({ firmas, firmaSeleccionada });
    } catch (error) {
        console.error('Error al obtener firmas:', error);
        res.status(500).json({ 
            msg: 'Error al obtener configuración de firmas',
            error: error.message 
        });
    }
};

const actualizarFirma = async (req, res) => {
    try {
        const { perfil } = req.body;
        let settings = getSettings();
        settings.firmaSeleccionada = perfil;
        saveSettings(settings);
        res.json({ msg: 'Firma actualizada correctamente' });
    } catch (error) {
        console.error('Error al actualizar firma:', error);
        res.status(500).json({ 
            msg: 'Error al actualizar firma',
            error: error.message 
        });
    }
};

module.exports = {
    obtenerFirmas,
    actualizarFirma
};