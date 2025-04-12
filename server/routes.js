const fs = require('fs');
const path = require('path');

const express = require('express');
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x');
const QRCode = require('qrcode');
const libre = require('libreoffice-convert');
const reader = require('xlsx');

const { folderPath, resultPath, resultDrinksPath, cardsPath, meses, getSettings, getBuffer, resultModulePath, saveSettings } = require('./config/Data');
const { convertImagesToPDF, convertPDFToPNG } = require('./config/Ghostscript');
const { createToFill, processPdfWithImages, handleError, ensureDirectoryExists, readTemplateFile, generateQr, dividirEnPaquetes, cambiarFormatoFecha, processCardPackage, generateQrBatch } = require('./utils');
const WebSocketManager = require('./config/WebSocket');

const router = express.Router();

/* const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
}; */

const QRTemplateModule = (nombreCompleto, documento, fechaExp, modulo) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. El dia ${fechaExp} Realizo el Modulo ${modulo} Del Curso De Manipulación Higiénica De Alimentos y BPM. Mayor Información Al WhatsApp 3107089494.`
};

const QRTemplateDrinks = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y Bebidas Alcohólicas. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};

router.get('/firmas', async (req, res) => {
    try {
        const { firmas, firmaSeleccionada } = getSettings()
        res.json({firmas, firmaSeleccionada})
    } catch (error) {
        console.log(error)
    }
})

router.post('/firmas', async (req, res) => {
    try {
        const { perfil } = req.body
        let settings = getSettings()
        settings.firmaSeleccionada = perfil
        saveSettings(settings)
        res.json({msg: 'ok'})
    } catch (error) {
        console.log(error)
    }
})

router.post('/modulos', async (req, res) => {
    try {
        const { nombreEmpresa, fecha, modulo } = req.body;
        const { modulos, firmas, firmaSeleccionada } = getSettings();
        const firmaData = firmas.find(fir => fir.firma === firmaSeleccionada);

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
                { nombres, cc },
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
        const totalTime = ((endTime - startTime) / 1000).toFixed(2); // En segundos
        

        WebSocketManager.send('Ready');
        res.json({ msg: `Modulos generados con éxito en ${totalTime} segundos.` });

    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
        handleError(res, error);
    }
});

router.post('/certificado', async (req, res) => {
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

        const headerExtension = new HeaderExtension();
        const handler = new TemplateHandler({
            extensions: {
                afterCompilation: [headerExtension]
            }
        });

        // Leer archivos
        const file = readTemplateFile(path.join(folderPath, "Plantilla.docx"));
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
        const pdfFileName = `CMA_${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`;
        const pdfFilePath = path.join(resultPath, pdfFileName);

        // Guardar PDF y procesar imágenes
        fs.writeFileSync(pdfFilePath, pdfBuf);
        const outputDir = path.join(resultPath, "images");
        await processPdfWithImages(pdfFilePath, outputDir);

        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2); // En segundos
        

        res.status(200).json({ 
            msg: `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}${fechaDate.getFullYear()}-${cc}.pdf Completado en ${totalTime} segundos` 
        });

    } catch (error) {
        handleError(res, error);
    }
});

router.post('/bebidas', async (req, res) => {
    try {
        const { nombres, apellidos, cc, fecha } = req.body;
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const firmaData = {
            ...firmas.find(fir => fir.firma === firmaSeleccionada),
            pathFirmaGemsap
        };

        // Crear el objeto toFill usando la función modularizada
        const toFill = createToFill(
            { nombres, apellidos, cc }, 
            firmaData,
            fecha
        );

        // Generar QR
        await generateQr(QRTemplateDrinks(nombres + " " + apellidos, 
            cc, `${toFill.dia}/${toFill.mesnum}/${toFill.aniov}`));

        const headerExtension = new HeaderExtension();
        const handler = new TemplateHandler({
            extensions: {
                afterCompilation: [headerExtension]
            }
        });

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

        res.status(200).json({ 
            msg: `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}${fechaDate.getFullYear()}-${cc}.pdf` 
        });

    } catch (error) {
        handleError(res, error);
    }
});

router.post('/carnets', async (req, res) => {
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
});

router.post('/carguemasivo', async (req, res) => {
    try {
        console.time('Cargue Masivo');
        const { nombreEmpresa, fecha } = req.body;
        const startTime = Date.now();
        
        // Preparar directorio de QRs
        const qrDir = path.join(resultPath, nombreEmpresa, 'qrs_temp');
        ensureDirectoryExists(qrDir);

        // Cargar configuración y firmas
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings();
        const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma } = firmas.find(
            fir => fir.firma === firmaSeleccionada
        );

        // Leer plantillas y datos
        const file = fs.readFileSync(folderPath + '/PlantillaSimple.docx');
        const plantillaX = reader.readFile(folderPath + '/Cargue_Masivo.xlsx');
        const dataClient = reader.utils.sheet_to_json(plantillaX.Sheets['data']);

        // Generar todos los QRs en paralelo
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Generando códigos QR en batch...'
        }));
        
        const qrResults = await generateQrBatch(dataClient, fecha, qrDir);

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

        // Preparar directorio de salida
        ensureDirectoryExists(path.join(resultPath, nombreEmpresa));

        let contador = 1;
        const total = dataClient.length;
        const handler = new TemplateHandler({});

        // Procesar cada cliente
        for (const client of dataClient) {
            const { nombres, apellidos, cc } = client;
            const qrInfo = qrResults.find(qr => qr.cc === cc);
            
            WebSocketManager.send(JSON.stringify({
                type: 'progress',
                message: 'Procesando certificado...',
                counter: `${contador} de ${total}`
            }));

            const fechaDate = new Date(client.fecha || fecha);
            const mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;

            // Crear documento
            console.time('Creacion Doc a PDF');
            const qrBuffer = fs.readFileSync(qrInfo.path);
            
            const doc = await handler.process(file, {
                ...toFillBase,
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

            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);
            console.timeEnd('Creacion Doc a PDF');

            // Guardar y procesar PDF
            const pdfFileName = `${nombreEmpresa}/CMA_${apellidos.split(' ')[0]}_${nombres.split(' ')[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`;
            const pdfFilePath = path.join(resultPath, pdfFileName);
            fs.writeFileSync(pdfFilePath, pdfBuf);

            // Procesar imágenes
            const outputDir = path.join(resultPath, "images_temp");
            ensureDirectoryExists(outputDir);
            
            const imagePaths = await convertPDFToPNG(pdfFilePath, outputDir);
            await convertImagesToPDF(imagePaths, pdfFilePath);

            // Limpieza
            for (const imagePath of imagePaths) {
                fs.unlinkSync(imagePath);
            }
            fs.rmSync(outputDir, { recursive: true, force: true });

            contador++;
        }

        // Limpieza final de QRs
        fs.rmSync(qrDir, { recursive: true, force: true });
        
        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        console.timeEnd('Cargue Masivo');

        WebSocketManager.send('Ready');
        res.json({ msg: `${contador-1} Certificados generados con éxito en ${totalTime} segundos` });

    } catch (error) {
        console.error(error);
        WebSocketManager.send('Error');
        res.status(500).json({ error: error.message });
    }
});

router.post('/masivobebidas', async (req, res) => {
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
        const file = fs.readFileSync(folderPath + '/PlantillaSimpleBebidas.docx');
        const plantillaX = reader.readFile(folderPath + '/Cargue_Masivo_Bebidas.xlsx');
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
        WebSocketManager.send(JSON.stringify({
            type: 'progress',
            message: 'Preparando directorio de salida...'
        }));
        if (!fs.existsSync(resultDrinksPath + '/' + nombreEmpresa)) {
            fs.mkdirSync(resultDrinksPath + '/' + nombreEmpresa);
        }

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
            const pdfFileName = `${nombreEmpresa}/CMB_${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`;
            const pdfFilePath = path.join(resultDrinksPath, pdfFileName);
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
    }
});

class HeaderExtension extends TemplateExtension {
    async execute(data, context) {
       const headerPaths = [ 'word/header1.xml', 'word/header2.xml', 'word/header3.xml' ];
       for (const headerPath of headerPaths) {
           const headerText = await context.docx.rawZipFile.getFile(headerPath).getContentText();
           const headerXml = this.utilities.xmlParser.parse(headerText);
           await this.utilities.compiler.compile(headerXml, data, context);
           const processedHeaderText = this.utilities.xmlParser.serialize(headerXml);
           context.docx.rawZipFile.setFile(headerPath, processedHeaderText);
           //this.headerTags = this.utilities.compiler.parseTags(headerXml);
      }
   }
}

module.exports = router;