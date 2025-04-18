const fs = require('fs');
const path = require('path');

const { MimeType } = require('easy-template-x');
const reader = require('xlsx');

const { getSettings } = require('../config/Data');
const WebSocketManager = require('../config/WebSocket');
const { 
    ensureDirectoryExists, 
    generateQrBatch,
    processBatchDocuments,
    processImageBatch 
} = require('../utils');
const { 
    folderPath, 
    resultPath, 
    meses,
    getBuffer 
} = require('../config/Data');


const procesarCargaMasiva = async (req, res) => {
    try {
        const { nombreEmpresa, fecha } = req.body;
        const startTime = Date.now();

        // 1. Preparar directorios
        const qrDir = path.join(resultPath, nombreEmpresa, 'qrs_temp');
        const outputDir = path.join(resultPath, nombreEmpresa);
        const tempDir = path.join(resultPath, nombreEmpresa, 'temp');
        ensureDirectoryExists(qrDir);
        ensureDirectoryExists(outputDir);
        ensureDirectoryExists(tempDir);

        // 2. Cargar datos y configuración
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const firmaData = firmas.find(fir => fir.firma === firmaSeleccionada);
        const file = fs.readFileSync(folderPath + '/PlantillaSimple.docx');
        const plantillaX = reader.readFile(folderPath + '/Cargue_Masivo.xlsx');
        const dataClient = reader.utils.sheet_to_json(plantillaX.Sheets['data']);

        // 3. Generar QRs en batch
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Generando códigos QR en batch...'
        }));
        const qrResults = await generateQrBatch(dataClient, fecha, qrDir);

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
            meses
        );

        // 6. Procesar imágenes en batch
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Procesando imágenes en batch...'
        }));
        await processImageBatch(pdfResults, tempDir);

        // 7. Limpieza final con manejo de errores
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

        WebSocketManager.send('Ready');
        
        res.json({ 
            msg: `${dataClient.length} Certificados generados con éxito en ${totalTime} segundos`,
            outputDir
        });

    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    procesarCargaMasiva
};