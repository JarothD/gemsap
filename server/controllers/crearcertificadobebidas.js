const fs = require('fs');
const path = require('path');
const { TemplateHandler, MimeType } = require('easy-template-x');
const libre = require('libreoffice-convert');

const { folderPath, resultDrinksPath, getSettings, meses } = require('../config/Data');
const { 
    createToFill, 
    generateQr, 
    readTemplateFile, 
    handleError, 
    ensureDirectoryExists,
    processImageBatch
} = require('../utils');

// Agregar el cache de plantillas
const templateCache = {
    handler: null,
    template: null
};

// Función para inicializar el cache
const initializeCache = () => {
    console.log('Initializing bebidas template cache');
    
    if (!templateCache.handler) {
        templateCache.handler = new TemplateHandler();
        console.log('Template handler created');
    }
    
    if (!templateCache.template) {
        const templatePath = path.join(folderPath, "PlantillaBebidas.docx");
        console.log('Loading template from:', templatePath);
        templateCache.template = readTemplateFile(templatePath);
    }
};

const getFechaFin = (fecha) => {
    const fechaDate = new Date(fecha);
    const fechaFin = new Date(fechaDate.setFullYear(fechaDate.getFullYear() + 1));
    const dia = fechaFin.getDate();
    const mes = fechaFin.getMonth() + 1;
    const anio = fechaFin.getFullYear();
    return `${dia < 10 ? '0' + dia : dia}/${mes < 10 ? '0' + mes : mes}/${anio}`;
};

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y Bebidas Alcohólicas. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`;
};

const crearCertificadoBebidas = async (req, res) => {
    try {
        console.log('Iniciando creación de certificado de bebidas');
        const startTime = Date.now();
        const { nombres, apellidos, cc, fecha } = req.body;
        console.log('Datos recibidos:', { nombres, apellidos, cc, fecha });

        // Asegurar que existen los directorios necesarios
        ensureDirectoryExists(resultDrinksPath);
        const tempDir = path.join(resultDrinksPath, "temp");
        ensureDirectoryExists(tempDir);

        // Inicializar cache si es necesario
        initializeCache();

        // Obtener configuraciones
        const settings = await getSettings();
        console.log('Configuración cargada, firma seleccionada:', settings.firmaSeleccionada);
        
        const firmaData = {
            ...settings.firmas.find(fir => fir.firma === settings.firmaSeleccionada),
            pathFirmaGemsap: settings.pathFirmaGemsap
        };
        console.log('Datos de firma:', { 
            nombreFirma: firmaData.nombreFirma, 
            tituloFirma: firmaData.tituloFirma 
        });

        // Generar código QR
        await generateQr(QRTemplate(
            `${nombres} ${apellidos}`, 
            cc, 
            getFechaFin(fecha)
        ));
        console.log('QR generado correctamente');
        const qrBuffer = readTemplateFile("qr.png");

        // Crear datos para la plantilla
        const fechaDate = new Date(fecha);
        const mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1)?.name || '';
        
        // Crear objeto de datos simplificado para asegurar compatibilidad con la plantilla
        const data = {
            nombres: nombres.toUpperCase(),
            apellidos: apellidos.toUpperCase(),
            nombre: nombres.split(' ')[0].toUpperCase(),
            apellido: apellidos.split(' ')[0].toUpperCase(),
            cc,
            dia: fechaDate.getUTCDate(),
            mes: mesName,
            mesnum: fechaDate.getUTCMonth() + 1,
            anio: fechaDate.getFullYear(),
            aniov: fechaDate.getFullYear() + 1,
            nombreFirma: firmaData.nombreFirma,
            tituloFirma: firmaData.tituloFirma,
            tarjetaProfesional: firmaData.tarjetaProfesional,
            qr: {
                _type: "image",
                source: qrBuffer,
                format: MimeType.Png,
                width: 115,
                height: 100
            },
            qr2: {
                _type: "image",
                source: qrBuffer,
                format: MimeType.Png,
                width: 142,
                height: 142
            },
            firmaGemsap: {
                _type: 'image',
                source: getBuffer(firmaData.pathFirmaGemsap),
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
        
        console.log('Variables para plantilla:', Object.keys(data));

        // Procesar documento usando cache y añadir QR
        console.log('Procesando plantilla con datos');
        const doc = await templateCache.handler.process(templateCache.template, data);

        // Convertir a PDF
        console.log('Convirtiendo documento a PDF');
        const pdfBuf = await convertToPdf(doc);
        const pdfFilePath = getPdfFilePath(nombres, apellidos, cc, fecha);
        
        // Escribir el archivo PDF
        console.log('Guardando PDF en:', pdfFilePath);
        await fs.promises.writeFile(pdfFilePath, pdfBuf);
        
        // Procesar imágenes
        const clientOutputDir = path.join(tempDir, cc.toString());
        ensureDirectoryExists(clientOutputDir);
        
        console.log('Procesando imágenes del PDF');
        await processImageBatch([{ pdfPath: pdfFilePath, cc }], tempDir);

        // Limpiar directorio temporal
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log('Directorio temporal eliminado');
        } catch (cleanupError) {
            console.warn("Error limpiando directorio temporal:", cleanupError);
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Certificado de bebidas completado en ${totalTime} segundos`);
        
        res.status(200).json({ 
            msg: `${getFileName(nombres, apellidos, fecha, cc)} Completado en ${totalTime} segundos`,
            outputDir: pdfFilePath
        });

    } catch (error) {
        console.error('Error en crearCertificadoBebidas:', error);
        handleError(res, error);
    }
};

// Funciones auxiliares
const getBuffer = (filePath) => {
    try {
        return fs.readFileSync(filePath);
    } catch (error) {
        console.error(`Error leyendo archivo ${filePath}:`, error);
        return Buffer.from(''); // Devolver buffer vacío en caso de error
    }
};

const convertToPdf = async (doc) => {
    return new Promise((resolve, reject) => {
        libre.convert(doc, '.pdf', undefined, (err, done) => {
            if (err) {
                console.error('Error en conversión a PDF:', err);
                reject(err);
            }
            resolve(done);
        });
    });
};

const getFileName = (nombres, apellidos, fecha, cc) => {
    const fechaDate = new Date(fecha);
    const mes = fechaDate.getMonth() + 1;
    return `CMB_${apellidos.split(' ')[0]}_${nombres.split(' ')[0]}_${mes}_${fechaDate.getFullYear()}_${cc}`;
};

const getPdfFilePath = (nombres, apellidos, cc, fecha) => {
    const fileName = getFileName(nombres, apellidos, fecha, cc);
    return path.join(resultDrinksPath, `${fileName}.pdf`);
};

module.exports = {
    crearCertificadoBebidas
};