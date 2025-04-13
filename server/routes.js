const express = require('express');
const { obtenerFirmas, actualizarFirma } = require('./controllers/perfilfirma');
const { procesarCargaMasiva } = require('./controllers/carguemasivo');
const { crearCertificado } = require('./controllers/crearcertificado');
const { generarCarnets } = require('./controllers/carnets');
const { certificarModulo } = require('./controllers/certificarmodulo');
const { crearCertificadoBebidas } = require('./controllers/crearcertificadobebidas');
const { procesarCargaMasivoBebidas } = require('./controllers/carguemasivobebidas');

const router = express.Router();

// Rutas de firmas
router.get('/firmas', obtenerFirmas);
router.post('/firmas', actualizarFirma);

// Otras rutas
router.post('/modulos', certificarModulo);
router.post('/certificado', crearCertificado);
router.post('/bebidas', crearCertificadoBebidas);
router.post('/carnets', generarCarnets);
router.post('/carguemasivo', procesarCargaMasiva);
router.post('/masivobebidas', procesarCargaMasivoBebidas);

module.exports = router;