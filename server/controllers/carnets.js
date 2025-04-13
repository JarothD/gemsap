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

        // Crear objeto base
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

        // Crear directorio si no existe
        ensureDirectoryExists(path.join(cardsPath, nombreEmpresa));

        let contador = 1;
        WebSocketManager.send(contador + ' de ' + dataClient.length);

        // Dividir clientes en paquetes de 4
        const paquetes = dividirEnPaquetes(dataClient, 4);

        // Procesar cada paquete
        for (let index = 0; index < paquetes.length; index++) {
            // Procesar el paquete actual
            const toFill = await processCardPackage(paquetes[index], toFillBase, QRTemplate);

            // Generar documento
            const doc = await handler.process(file, toFill);
            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);

            // Guardar y procesar PDF
            const pdfFileName = `${nombreEmpresa}/Paquete${index}.pdf`;
            const pdfFilePath = path.join(cardsPath, pdfFileName);
            fs.writeFileSync(pdfFilePath, pdfBuf);

            // Procesar imágenes
            const outputDir = path.join(cardsPath, "images");
            await processPdfWithImages(pdfFilePath, outputDir);

            contador += paquetes[index].length;
            WebSocketManager.send(contador + ' de ' + dataClient.length);
        }

        WebSocketManager.send('Ready');
        res.json({ msg: 'Certificados generados con éxito' });
    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
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