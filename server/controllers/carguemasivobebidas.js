const fs = require('fs');
const path = require('path');
const reader = require('xlsx');
const { TemplateHandler, MimeType } = require('easy-template-x');
const libre = require('libreoffice-convert');

const { folderPath, resultDrinksPath, getSettings, meses, getBuffer } = require('../config/Data');
const { generateQr, cambiarFormatoFecha } = require('../utils');
const { convertImagesToPDF, convertPDFToPNG } = require('../config/Ghostscript');
const WebSocketManager = require('../config/WebSocket');

const QRTemplateDrinks = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y Bebidas Alcohólicas. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};

const procesarCargaMasivoBebidas = async (req, res) => {
    try {
        const { nombreEmpresa, fecha } = req.body;

        // Notificar inicio del proceso
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Iniciando proceso de generación de certificados de bebidas...'
        }));

        // Cargar configuración y firmas
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Cargando configuración y firmas...'
        }));
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada);

        // Configurar el manejador de plantillas
        const handler = new TemplateHandler({});

        // Leer plantillas y datos
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Leyendo plantillas y datos...'
        }));
        const file = fs.readFileSync(path.join(folderPath, 'PlantillaSimpleBebidas.docx'));
        const plantillaX = reader.readFile(path.join(folderPath, 'Cargue_Masivo_Bebidas.xlsx'));
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // Crear objeto base para toFill
        const toFillBase = {
            nombreFirma,
            tituloFirma,
            tarjetaProfesional,
            firmaGemsap: {
                _type: 'image',
                source: getBuffer(pathFirmaGemsap),
                format: MimeType.Png,
                width: 166,
                height: 106
            },
            firma: {
                _type: 'image',
                source: getBuffer(pathFirma),
                format: MimeType.Png,
                width: 170,
                height: 110
            }
        };

        // Preparar directorio
        const empresaPath = path.join(resultDrinksPath, nombreEmpresa);
        fs.mkdirSync(empresaPath, { recursive: true });

        let contador = 1;
        const total = dataClient.length;

        // Procesar cada cliente
        for (const client of dataClient) {
            let { nombres, apellidos, cc } = client;

            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: 'Preparando datos del certificado...',
                counter: `${contador} de ${total}`
            }));

            nombres = nombres.toUpperCase();
            apellidos = apellidos.toUpperCase();
            
            let nombresSplitted = nombres.split(' ');
            let apellidosSplitted = apellidos.split(' ');
            let fechaDate = new Date(fecha);
            let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
            
            if(client.fecha){
                let nuevaFecha = cambiarFormatoFecha(client.fecha);
                fechaDate = new Date(nuevaFecha);
                mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
            }

            let toFill = {
                ...toFillBase,
                dia: fechaDate.getUTCDate(),
                mes: mesName,
                mesnum: fechaDate.getUTCMonth() + 1,
                anio: fechaDate.getFullYear(),
                aniov: fechaDate.getFullYear() + 1,
                nombres: nombres,
                apellidos: apellidos,
                nombre: nombresSplitted[0],            
                apellido: apellidosSplitted[0],
                cc: cc
            };

            // Generar código QR
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: 'Generando código QR...',
                counter: `${contador} de ${total}`
            }));
            await generateQr(QRTemplateDrinks(nombres + ' ' + apellidos, cc, `${toFill.dia}/${toFill.mesnum}/${toFill.aniov}`));
            const qrfile = fs.readFileSync('qr.png');

            // Crear documento
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: 'Creando documento PDF...',
                counter: `${contador} de ${total}`
            }));
            const doc = await handler.process(file, {
                ...toFill,
                qr: {
                    _type: 'image',
                    source: qrfile,
                    format: MimeType.Png,
                    width: 106,
                    height: 106
                },
                qr2: {
                    _type: 'image',
                    source: qrfile,
                    format: MimeType.Png,
                    width: 142,
                    height: 142
                }
            });

            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);
            
            // Guardar PDF
            const pdfFileName = `CMB_${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`;
            const pdfFilePath = path.join(empresaPath, pdfFileName);
            fs.writeFileSync(pdfFilePath, pdfBuf);

            // Procesar imágenes
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: 'Procesando imágenes...',
                counter: `${contador} de ${total}`
            }));
            const outputDir = path.join(resultDrinksPath, "images");
            fs.mkdirSync(outputDir, { recursive: true });

            const imagePaths = await convertPDFToPNG(pdfFilePath, outputDir);
            await convertImagesToPDF(imagePaths, pdfFilePath);

            // Limpieza de archivos temporales
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: 'Limpiando archivos temporales...',
                counter: `${contador} de ${total}`
            }));
            for (const imagePath of imagePaths) {
                try {
                    fs.unlinkSync(imagePath);
                } catch (err) {
                    console.error(`Error al eliminar la imagen ${imagePath}:`, err);
                }
            }

            try {
                fs.rmSync(outputDir, { recursive: true, force: true });
            } catch (err) {
                console.error(`Error al eliminar la carpeta ${outputDir}:`, err);
            }

            contador++;
        }

        WebSocketManager.send('Ready');
        res.json({ msg: 'Certificados generados con éxito' });
    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
        res.status(500).json({ msg: 'Error al generar certificados' });
    }
};

module.exports = {
    procesarCargaMasivoBebidas
};