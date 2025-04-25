const fs = require('fs');
const path = require('path');
const reader = require('xlsx');
const { MimeType } = require('easy-template-x');

const { 
    folderPath, 
    resultDrinksPath, 
    getSettings, 
    meses,
    getBuffer 
} = require('../config/Data');
const { 
    ensureDirectoryExists, 
    generateQrBatch,
    processBatchDocuments,
    processImageBatch 
} = require('../utils');
const WebSocketManager = require('../config/WebSocket');

const QRTemplateDrinks = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y Bebidas Alcohólicas. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`;
};

const procesarCargaMasivoBebidas = async (req, res) => {
    try {
        const { nombreEmpresa, fecha } = req.body;
        const startTime = Date.now();
        console.log('Comienza cargue masivo')
        // 1. Preparar directorios
        const qrDir = path.join(resultDrinksPath, nombreEmpresa, 'qrs_temp');
        const outputDir = path.join(resultDrinksPath, nombreEmpresa);
        const tempDir = path.join(resultDrinksPath, nombreEmpresa, 'temp');
        ensureDirectoryExists(qrDir);
        ensureDirectoryExists(outputDir);
        ensureDirectoryExists(tempDir);

        // 2. Cargar datos y configuración
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Cargando configuración...'
        }));
        
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const firmaData = firmas.find(fir => fir.firma === firmaSeleccionada);
        const file = fs.readFileSync(path.join(folderPath, 'PlantillaSimpleBebidas.docx'));
        const plantillaX = reader.readFile(path.join(folderPath, 'Cargue_Masivo_Bebidas.xlsx'));
        const dataClient = reader.utils.sheet_to_json(plantillaX.Sheets['data']);

        // 3. Generar QRs en batch
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Generando códigos QR en batch...'
        }));
        const qrResults = await generateQrBatch(dataClient, fecha, qrDir, QRTemplateDrinks);

        // 4. Preparar datos base
        const toFillBase = {
            nombreFirma: firmaData.nombreFirma,
            tituloFirma: firmaData.tituloFirma,
            tarjetaProfesional: firmaData.tarjetaProfesional,
            firmaGemsap: {
                _type: 'image',
                source: getBuffer(pathFirmaGemsap),
                format: MimeType.Png,
                width: 166,
                height: 106
            },
            firma: {
                _type: 'image',
                source: getBuffer(firmaData.pathFirma),
                format: MimeType.Png,
                width: 170,
                height: 110
            }
        };

        // 5. Procesar documentos en batch
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Procesando documentos en batch...'
        }));
        const pdfResults = await processBatchDocuments(
            dataClient, 
            file, 
            toFillBase, 
            qrResults, 
            outputDir,
            fecha,
            meses,
            'CMB' // Prefijo para archivos de bebidas
        );

        // 6. Procesar imágenes en batch
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Procesando imágenes en batch...'
        }));
        await processImageBatch(pdfResults, tempDir);

        // 7. Limpieza final
        try {
            if (fs.existsSync(qrDir)) {
                fs.rmSync(qrDir, { recursive: true, force: true });
            }
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.log('Aviso: Error en limpieza final:', cleanupError.code);
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        WebSocketManager.send(JSON.stringify({
            type: 'status',
            status: 'ready',
            message: `${dataClient.length} Certificados generados con éxito en ${totalTime} segundos`
        }));
        res.json({ 
            msg: `${dataClient.length} Certificados generados con éxito en ${totalTime} segundos`,
            outputDir
        });

    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
        res.status(500).json({ msg: 'Error al generar certificados' });
    }
};

module.exports = {
    procesarCargaMasivoBebidas
};