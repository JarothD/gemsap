const { parentPort } = require('worker_threads');
const fs = require('fs');
const { TemplateHandler } = require('easy-template-x');
const libre = require('libreoffice-convert');
const QRCode = require('qrcode');
const { MimeType } = require('easy-template-x');
const { convertPDFToPNG, convertImagesToPDF } = require('./config/Ghostscript');

// Define QR template and generation locally in worker
const generateQR = async (templateQr) => {
    const opts = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.9,
    };
    
    
    await QRCode.toFile('qr.png', templateQr, opts);
    const qrBuffer = fs.readFileSync('qr.png');
    
    return qrBuffer;
};

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`;
};

parentPort.on('message', async (data) => {
    try {
        const { 
            batch, 
            toFillBase, 
            file, 
            nombreEmpresa, 
            resultPath,
            fecha 
        } = data;

        const results = [];

        for (const client of batch) {
            // Process each client
            let { nombres, apellidos, cc } = client;
            nombres = nombres.toUpperCase();
            apellidos = apellidos.toUpperCase();

            // Generate QR using local template
            const fechaDate = new Date(client.fecha || fecha);
            const qrBuffer = await generateQR(
                QRTemplate(
                    `${nombres} ${apellidos}`, 
                    cc, 
                    `${fechaDate.getUTCDate()}/${fechaDate.getUTCMonth() + 1}/${fechaDate.getFullYear() + 1}`
                )
            );

            // Rest of processing...
            const handler = new TemplateHandler({});

            // Crear toFill para este cliente
            const toFill = {
                ...toFillBase,
                nombres,
                apellidos,
                nombre: nombres.split(' ')[0],
                apellido: apellidos.split(' ')[0],
                cc,
                // ... otros campos de fecha
            };

            // Procesar documento
            const doc = await handler.process(file, {
                ...toFill,
                qr: {
                    _type: 'image',
                    source: qrBuffer,
                    format: MimeType.Png,
                    width: 106,
                    height: 106
                },
                qr2: {
                    _type: 'image',
                    source: qrBuffer,
                    format: MimeType.Png,
                    width: 142,
                    height: 142
                }
            });

            // Convertir a PDF
            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);

            // Guardar PDF
            const pdfFileName = `${nombreEmpresa}/CMA_${toFill.apellido.toUpperCase()}_${toFill.nombre.toUpperCase()}_${toFill.mesnum}_${toFill.anio}_${cc}.pdf`;
            const pdfFilePath = `${resultPath}/${pdfFileName}`;
            fs.writeFileSync(pdfFilePath, pdfBuf);

            // Procesar imágenes
            const outputDir = `${resultPath}/images`;
            fs.mkdirSync(outputDir, { recursive: true });

            const imagePaths = await convertPDFToPNG(pdfFilePath, outputDir);
            await convertImagesToPDF(imagePaths, pdfFilePath);

            // Limpieza
            for (const imagePath of imagePaths) {
                fs.unlinkSync(imagePath);
            }
            fs.rmSync(outputDir, { recursive: true, force: true });

            results.push({ success: true, fileName: pdfFileName });
        }

        parentPort.postMessage({ success: true, results });
    } catch (error) {
        parentPort.postMessage({ success: false, error: error.message });
    }
});