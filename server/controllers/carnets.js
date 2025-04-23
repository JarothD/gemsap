const fs = require('fs');
const path = require('path');
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x');
const reader = require('xlsx');
const libre = require('libreoffice-convert');

const { folderPath, cardsPath, getSettings, getBuffer } = require('../config/Data');
const { 
    readTemplateFile, 
    dividirEnPaquetes, 
    processCardPackage, 
    processPdfWithImages, 
    handleError, 
    ensureDirectoryExists 
} = require('../utils');
const WebSocketManager = require('../config/WebSocket');

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};

const generarCarnets = async (req, res) => {
    try {
        const { nombreEmpresa } = req.body;
        const startTime = Date.now();

        // 1. Preparar directorios
        const qrDir = path.join(cardsPath, nombreEmpresa, 'qrs_temp');
        const outputDir = path.join(cardsPath, nombreEmpresa);
        const tempDir = path.join(cardsPath, nombreEmpresa, 'temp');
        ensureDirectoryExists(qrDir);
        ensureDirectoryExists(outputDir);
        ensureDirectoryExists(tempDir);

        // 2. Cargar datos y configuración
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Cargando datos y configuración...'
        }));
        
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const firmaData = firmas.find(fir => fir.firma === firmaSeleccionada);

        // Inicializar el handler con HeaderExtension
        const headerExtension = new HeaderExtension();
        const handler = new TemplateHandler({
            extensions: {
                afterCompilation: [headerExtension]
            }
        });

        // Leer archivos
        const file = readTemplateFile(path.join(folderPath, "PlantillaCarnets.docx"));
        const plantillaX = reader.readFile(path.join(folderPath, "Cargue_Carnets.xlsx"));
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // 3. Crear objeto base para los carnets
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Preparando datos base para carnets...'
        }));
        
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

        // 4. Dividir clientes en paquetes y procesar
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: `Preparando paquetes de carnets para ${dataClient.length} clientes...`
        }));
        
        const paquetes = dividirEnPaquetes(dataClient, 4);
        let contador = 1;
        let pdfResults = [];

        // 5. Procesar cada paquete
        for (let index = 0; index < paquetes.length; index++) {
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: `Procesando paquete ${index+1}/${paquetes.length} (${contador} de ${dataClient.length} carnets)...`
            }));
            
            // Procesar el paquete actual
            const toFill = await processCardPackage(paquetes[index], toFillBase, QRTemplate);

            // Generar documento
            const doc = await handler.process(file, toFill);
            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);

            // Guardar PDF
            const pdfFileName = `Paquete${index}.pdf`;
            const pdfFilePath = path.join(outputDir, pdfFileName);
            fs.writeFileSync(pdfFilePath, pdfBuf);
            
            // Agregar a resultados para procesar imágenes después
            pdfResults.push({ pdfPath: pdfFilePath, paqueteIndex: index });

            contador += paquetes[index].length;
        }

        // 6. Procesar imágenes para todos los paquetes
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Procesando imágenes de carnets...'
        }));
        
        for (const result of pdfResults) {
            await processPdfWithImages(result.pdfPath, tempDir);
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: `Procesado paquete ${result.paqueteIndex + 1}/${paquetes.length}...`
            }));
        }

        // 7. Limpieza final con manejo de errores
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Finalizando proceso y limpiando archivos temporales...'
        }));
        
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

        // Final completion message
        WebSocketManager.send(JSON.stringify({
            type: 'status',
            status: 'ready',
            message: `${dataClient.length} Carnets generados con éxito en ${totalTime} segundos`
        }));

        res.json({ 
            msg: `${dataClient.length} Carnets generados con éxito en ${totalTime} segundos`,
            outputDir
        });
    } catch (error) {
        console.error(error);
        WebSocketManager.send(JSON.stringify({
            type: 'status',
            status: 'error',
            message: 'Error al procesar los carnets: ' + error.message
        }));
        
        handleError(res, error);
    }
};

// Define HeaderExtension class
class HeaderExtension extends TemplateExtension {
    async execute(data, context) {
        if (!context.isHeader) {
            return;
        }
        data._pageNum = context.pageNum;
    }
}

module.exports = {
    generarCarnets
};