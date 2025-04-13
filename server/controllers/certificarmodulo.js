const fs = require('fs');
const path = require('path');
const { TemplateHandler, MimeType } = require('easy-template-x');
const reader = require('xlsx');
const libre = require('libreoffice-convert');

const { folderPath, resultModulePath, getSettings, getBuffer } = require('../config/Data');
const { createToFill, generateQr, readTemplateFile, processPdfWithImages, handleError, ensureDirectoryExists } = require('../utils');
const WebSocketManager = require('../config/WebSocket');

const QRTemplateModule = (nombreCompleto, documento, fechaExp, modulo) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. El dia ${fechaExp} Realizo el Modulo ${modulo} Del Curso De Manipulación Higiénica De Alimentos y BPM. Mayor Información Al WhatsApp 3107089494.`
};

const certificarModulo = async (req, res) => {
    try {
        const { nombreEmpresa, fecha, modulo } = req.body;
        const { modulos, firmas, firmaSeleccionada, pathFirmaGemsap } = getSettings();
        const firmaData = {
            ...firmas.find(fir => fir.firma === firmaSeleccionada),
            pathFirmaGemsap
        };

        const handler = new TemplateHandler({});        
        
        const startTime = Date.now();

        // Leer archivos
        const file = readTemplateFile(path.join(folderPath, "PlantillaModulo.docx"));
        const plantillaX = reader.readFile(path.join(folderPath, "Cargue_Modulo.xlsx"));
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // Crear objeto base para toFill
        const chosenModule = modulos.find(toFind => toFind.modulo == modulo);
        const toFillBase = {
            nombreFirma: firmaData.nombreFirma,
            tituloFirma: firmaData.tituloFirma,
            tarjetaProfesional: firmaData.tarjetaProfesional,
            firma: {
                _type: 'image',
                source: getBuffer(firmaData.pathFirma),
                format: MimeType.Png,
                width: 170,
                height: 110
            },
            firmaGemsap: {
                _type: 'image',
                source: getBuffer(pathFirmaGemsap),
                format: MimeType.Png,
                width: 166,
                height: 106
            },
            modulo: chosenModule.modulo,
            temas: chosenModule.temas,
            horas: chosenModule.horas
        };

        // Crear directorio si no existe
        ensureDirectoryExists(path.join(resultModulePath, nombreEmpresa));

        let contador = 1;
        WebSocketManager.send(contador + ' de ' + dataClient.length);

        for (const client of dataClient) {
            let { nombres, cc } = client;
            nombres = nombres.toUpperCase();

            // Crear objeto toFill para el cliente actual
            const toFill = createToFill(
                { 
                    nombres: nombres.split(' ')[0] || nombres, // Take first name if multiple
                    apellidos: nombres.split(' ').slice(1).join(' ') || '', // Rest of the name as surname
                    cc 
                },
                firmaData,
                client.fecha || fecha,
                {
                    ...toFillBase,
                    modulo: chosenModule.modulo,
                    temas: chosenModule.temas,
                    horas: chosenModule.horas
                }
            );

            // Generar QR
            await generateQr(QRTemplateModule(nombres + ' ', cc,
                `${toFill.dia}/${toFill.mesnum}/${toFill.anio}`, chosenModule.modulo));

            const qrfile = readTemplateFile("qr.png");

            // Procesar documento
            const doc = await handler.process(file, {
                ...toFill,
                qr: {
                    _type: 'image',
                    source: qrfile,
                    format: MimeType.Png,
                    width: 140,
                    height: 140
                }
            });

            // Convertir a PDF
            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);

            // Crear nombre del archivo y ruta
            const pdfFileName = `${nombreEmpresa}/M${modulo}_${toFill.nombre}_${toFill.mesnum}_${toFill.anio}_${cc}.pdf`;
            const pdfFilePath = path.join(resultModulePath, pdfFileName);

            // Guardar PDF y procesar imágenes
            fs.writeFileSync(pdfFilePath, pdfBuf);
            const outputDir = path.join(resultModulePath, "images");
            await processPdfWithImages(pdfFilePath, outputDir);

            contador++;
            WebSocketManager.send(contador + ' de ' + dataClient.length);
        }

        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);

        WebSocketManager.send('Ready');
        res.json({ msg: `Modulos generados con éxito en ${totalTime} segundos.` });

    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
        handleError(res, error);
    }
};

module.exports = {
    certificarModulo
};