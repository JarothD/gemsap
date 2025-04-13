const fs = require('fs');
const path = require('path');
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x');
const libre = require('libreoffice-convert');

const { folderPath, resultPath, getSettings } = require('../config/Data');
const { createToFill, readTemplateFile, handleError, ensureDirectoryExists } = require('../utils');
const { convertImagesToPDF, convertPDFToPNG } = require('../config/Ghostscript'); // Agregar esta línea

// Agregar después de las importaciones
const getFechaFin = (fecha) => {
    const fechaDate = new Date(fecha);
    const fechaFin = new Date(fechaDate.setFullYear(fechaDate.getFullYear() + 1));
    const dia = fechaFin.getDate();
    const mes = fechaFin.getMonth() + 1;
    const anio = fechaFin.getFullYear();
    return `${dia < 10 ? '0' + dia : dia}/${mes < 10 ? '0' + mes : mes}/${anio}`;
};

// Modificar la función processPdfWithImages para crear el directorio si no existe
const processPdfWithImages = async (pdfPath, outputDir) => {
    try {
        // Asegurar que el directorio existe
        ensureDirectoryExists(outputDir);
        
        // Primero generar los archivos PNG
        const pngFiles = await convertPDFToPNG(pdfPath, outputDir);
        
        // Luego convertir las imágenes a PDF
        await convertImagesToPDF(pngFiles, pdfPath);
        
        // Limpiar archivos temporales
        for (const pngFile of pngFiles) {
            try {
                fs.unlinkSync(pngFile);
            } catch (err) {
                console.warn(`No se pudo eliminar archivo temporal: ${pngFile}`, err);
            }
        }

    } catch (error) {
        throw new Error(`Error procesando PDF con imágenes: ${error.message}`);
    }
};

// Modificar la función generateQr para usar una resolución óptima
const generateQr = async (text, size = 256) => {
    const qr = require('qrcode');
    const opts = {
        errorCorrectionLevel: 'M',
        type: 'png',
        quality: 0.92,
        width: size,
        margin: 1
    };
    return qr.toFile('qr.png', text, opts);
};

// Al inicio del archivo, agregar cache
const templateCache = {
    handler: null,
    template: null,
    firmaGemsap: null
};

// Función para inicializar el cache
const initializeCache = () => {
    if (!templateCache.handler) {
        const headerExtension = new HeaderExtension();
        templateCache.handler = new TemplateHandler({
            extensions: {
                afterCompilation: [headerExtension]
            }
        });
    }
    if (!templateCache.template) {
        templateCache.template = readTemplateFile(path.join(folderPath, "Plantilla.docx"));
    }
};

// Define HeaderExtension class
class HeaderExtension extends TemplateExtension {
    async execute(data, context) {
        if (!context.isHeader) {
            return;
        }
        data._pageNum = context.pageNum;
        data._pageNum = context.pageNum;
    }
}

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};

// Modificar la función crearCertificado para manejar mejor los directorios
const crearCertificado = async (req, res) => {
    try {
        const startTime = Date.now();
        const { nombres, apellidos, cc, fecha } = req.body;

        // Asegurar que existen los directorios necesarios
        ensureDirectoryExists(resultPath);
        ensureDirectoryExists(path.join(resultPath, "images"));

        // Inicializar cache si es necesario
        initializeCache();

        // Ejecutar operaciones en paralelo
        const [settings, qr] = await Promise.all([
            getSettings(),
            generateQr(QRTemplate(
                `${nombres} ${apellidos}`, 
                cc, 
                getFechaFin(fecha)
            ))
        ]);

        const firmaData = {
            ...settings.firmas.find(fir => fir.firma === settings.firmaSeleccionada),
            pathFirmaGemsap: settings.pathFirmaGemsap
        };

        // Crear datos para la plantilla
        const toFill = createToFill(
            { nombres, apellidos, cc }, 
            firmaData,
            fecha
        );

        // Procesar documento usando cache
        const doc = await templateCache.handler.process(templateCache.template, {
            ...toFill,
            qr: {
                _type: "image",
                source: readTemplateFile("qr.png"),
                format: MimeType.Png,
                width: 115,
                height: 100
            },
            qr2: {
                _type: "image",
                source: readTemplateFile("qr.png"),
                format: MimeType.Png,
                width: 142,
                height: 142
            }
        });

        // Conversión y procesamiento en paralelo
        const pdfBuf = await convertToPdf(doc);
        const pdfFilePath = getPdfFilePath(nombres, apellidos, cc, fecha);
        const imagesDir = path.join(resultPath, "images", getFileName(nombres, apellidos, fecha, cc));
        
        await Promise.all([
            fs.promises.writeFile(pdfFilePath, pdfBuf),
            processPdfWithImages(pdfFilePath, imagesDir)
        ]);

        // Limpiar directorio de imágenes
        try {
            fs.rmSync(imagesDir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.warn("Error limpiando directorio temporal:", cleanupError);
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        res.status(200).json({ 
            msg: `${getFileName(nombres, apellidos, fecha, cc)} Completado en ${totalTime} segundos` 
        });

    } catch (error) {
        handleError(res, error);
    }
};

// Modificar la función de conversión a PDF
const convertToPdf = async (doc) => {
    return new Promise((resolve, reject) => {
        libre.convert(doc, '.pdf', undefined, (err, done) => {
            if (err) {
                reject(err);
            }
            resolve(done);
        });
    });
};

// Agregar después de las funciones utilitarias existentes
const getFileName = (nombres, apellidos, fecha, cc) => {
    const fechaDate = new Date(fecha);
    const mes = fechaDate.getMonth() + 1;
    return `CMA_${apellidos.split(' ')[0]}_${nombres.split(' ')[0]}_${mes}_${fechaDate.getFullYear()}_${cc}`;
};

const getPdfFilePath = (nombres, apellidos, cc, fecha) => {
    const fileName = getFileName(nombres, apellidos, fecha, cc);
    return path.join(resultPath, `${fileName}.pdf`);
};

module.exports = {
    crearCertificado
};