const fs = require('fs');
const path = require('path');
const { TemplateHandler, MimeType } = require('easy-template-x');
const libre = require('libreoffice-convert');

const { folderPath, resultDrinksPath, getSettings } = require('../config/Data');
const { createToFill, generateQr, readTemplateFile, processPdfWithImages, handleError } = require('../utils');

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y Bebidas Alcohólicas. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};

const crearCertificadoBebidas = async (req, res) => {
    try {
        const { nombres, apellidos, cc, fecha } = req.body;
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const firmaData = {
            ...firmas.find(fir => fir.firma === firmaSeleccionada),
            pathFirmaGemsap
        };

        const startTime = Date.now();

        // Crear el objeto toFill usando la función modularizada
        const toFill = createToFill(
            { nombres, apellidos, cc }, 
            firmaData,
            fecha
        );

        // Generar QR
        await generateQr(QRTemplate(nombres + " " + apellidos, 
            cc, `${toFill.dia}/${toFill.mesnum}/${toFill.aniov}`));

        const handler = new TemplateHandler();

        // Leer archivos
        const file = readTemplateFile(path.join(folderPath, "PlantillaBebidas.docx"));
        const qrfile = readTemplateFile("qr.png");

        // Procesar documento
        const doc = await handler.process(file, {
            ...toFill,
            qr: {
                _type: "image",
                source: qrfile,
                format: MimeType.Png,
                width: 115,
                height: 100
            },
            qr2: {
                _type: "image",
                source: qrfile,
                format: MimeType.Png,
                width: 142,
                height: 142
            }
        });

        // Convertir a PDF
        const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);

        // Crear nombre del archivo y ruta
        const nombresSplitted = nombres.split(' ');
        const apellidosSplitted = apellidos.split(' ');
        const fechaDate = new Date(fecha);
        const pdfFileName = `CMB_${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`;
        const pdfFilePath = path.join(resultDrinksPath, pdfFileName);

        // Guardar PDF y procesar imágenes
        fs.writeFileSync(pdfFilePath, pdfBuf);
        const outputDir = path.join(resultDrinksPath, "images");
        await processPdfWithImages(pdfFilePath, outputDir);

        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2); // En segundos

        res.status(200).json({ 
            msg: `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}${fechaDate.getFullYear()}-${cc}.pdf Completado en ${totalTime} segundos` 
        });

    } catch (error) {
        handleError(res, error);
    }
};

module.exports = {
    crearCertificadoBebidas
};