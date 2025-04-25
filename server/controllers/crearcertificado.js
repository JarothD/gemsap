const fs = require('fs');
const path = require('path');
const { TemplateHandler, MimeType } = require('easy-template-x');
const libre = require('libreoffice-convert');

const { folderPath, resultPath, getSettings, meses } = require('../config/Data');
const { 
    createToFill, 
    readTemplateFile, 
    handleError, 
    ensureDirectoryExists,
    generateQr,
    processImageBatch
} = require('../utils');

// Agregar después de las importaciones
const getFechaFin = (fecha) => {
    const fechaDate = new Date(fecha);
    const fechaFin = new Date(fechaDate.setFullYear(fechaDate.getFullYear() + 1));
    const dia = fechaFin.getDate();
    const mes = fechaFin.getMonth() + 1;
    const anio = fechaFin.getFullYear();
    return `${dia < 10 ? '0' + dia : dia}/${mes < 10 ? '0' + mes : mes}/${anio}`;
};

// Al inicio del archivo, agregar cache
const templateCache = {
    handler: null,
    template: null
};

// Función para inicializar el cache
const initializeCache = () => {
    console.log('Initializing template cache');
    
    if (!templateCache.handler) {
        // Creamos un TemplateHandler simple sin extensiones personalizadas
        templateCache.handler = new TemplateHandler();
        console.log('Template handler created');
    }
    
    if (!templateCache.template) {
        const templatePath = path.join(folderPath, "Plantilla.docx");
        console.log('Loading template from:', templatePath);
        templateCache.template = readTemplateFile(templatePath);
    }
};

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};

// Modificar la función crearCertificado para manejar mejor los directorios
const crearCertificado = async (req, res) => {
    try {
        console.log('Iniciando creación de certificado');
        const startTime = Date.now();
        const { nombres, apellidos, cc, fecha } = req.body;
        console.log('Datos recibidos:', { nombres, apellidos, cc, fecha });

        // Asegurar que existen los directorios necesarios
        ensureDirectoryExists(resultPath);
        const tempDir = path.join(resultPath, "temp");
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
        const qrText = QRTemplate(
            `${nombres} ${apellidos}`, 
            cc, 
            getFechaFin(fecha)
        );
        console.log('Generando QR con texto:', qrText);
        await generateQr(qrText);

        // Leer QR generado
        const qrBuffer = readTemplateFile("qr.png");
        console.log('QR generado correctamente');

        // Crear datos para la plantilla usando mayúsculas como en processBatchDocuments
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
            },
            anexo: {
                _type: 'image',
                source: getBuffer(firmaData.pathAnexo),
                format: MimeType.Png,
                width: 673,
                height: 802
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
        
        // Usar processImageBatch como en carguemasivo.js
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
        console.log(`Certificado completado en ${totalTime} segundos`);
        const outputDir = getPdfFilePath(nombres, apellidos, fecha, cc)
        res.status(200).json({ 
            msg: `${getFileName(nombres, apellidos, fecha, cc)} Completado en ${totalTime} segundos`,
            outputDir
        });

    } catch (error) {
        console.error('Error en crearCertificado:', error);
        handleError(res, error);
    }
};

// Obtener buffer de archivo
const getBuffer = (filePath) => {
    try {
        return fs.readFileSync(filePath);
    } catch (error) {
        console.error(`Error leyendo archivo ${filePath}:`, error);
        return Buffer.from(''); // Devolver buffer vacío en caso de error
    }
};

// Modificar la función de conversión a PDF
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