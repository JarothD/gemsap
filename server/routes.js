const express = require('express');
const fs = require('fs');
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x');
const QRCode = require('qrcode');
const libre = require('libreoffice-convert');
const { folderPath, resultPath, resultDrinksPath, cardsPath, meses, getSettings, getBuffer, resultModulePath, saveSettings } = require('./config/Data');
const reader = require('xlsx');
const { convertImagesToPDF, convertPDFToPNG } = require('./config/Ghostscript');
const path = require('path');

const router = express.Router();

let QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
    }

let QRTemplateModule = (nombreCompleto, documento, fechaExp, modulo) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. El dia ${fechaExp} Realizo el Modulo ${modulo} Del Curso De Manipulación Higiénica De Alimentos y BPM. Mayor Información Al WhatsApp 3107089494.`
    }

let QRTemplateDrinks = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y Bebidas Alcohólicas. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
}

const generateQr = async (templateQr) => {
    var opts = {
        errorCorrectionLevel: 'M',
        type: 'image/jpeg',
        quality: 0.9,
    };

    try {
        await QRCode.toFile('qr.png', templateQr, opts);
    } catch (error) {
        console.log(error);
    }
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
        const {  modulos, firmas, firmaSeleccionada } = getSettings()

        const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada)

        const filenameDocx = 'PlantillaModulo.docx';
        const filenameXlsx = 'Cargue_Modulo.xlsx';

        const handler = new TemplateHandler({});

        // Leer los archivos una vez fuera del bucle
        const file = fs.readFileSync(folderPath + '/' + filenameDocx);
        const plantillaX = reader.readFile(folderPath + '/' + filenameXlsx);
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // Crear objeto toFill una vez fuera del bucle
        //const fechaDate = new Date(fecha);
        //const mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
        const chosenModule = modulos.find(toFind => toFind.modulo == modulo)
        
        const toFillBase = {
            /* dia: fechaDate.getUTCDate(),
            mes: mesName,
            mesnum: fechaDate.getUTCMonth() + 1,
            anio: fechaDate.getFullYear(),   */          
            nombreFirma,
            tituloFirma,
            tarjetaProfesional,
            firma: {
                _type: 'image',
                source: getBuffer(pathFirma),
                format: MimeType.Png,
                width: 170,
                height: 110
            },
            modulo: chosenModule.modulo,
            temas: chosenModule.temas,
            horas: chosenModule.horas
        };

        if (!fs.existsSync(resultModulePath + '/' + nombreEmpresa)) {
            fs.mkdirSync(resultModulePath + '/' + nombreEmpresa);
        }

        let contador = 1;
        global.send(contador + ' de ' + dataClient.length);

        for (const client of dataClient) {
            let { nombres, cc } = client;

            nombres = nombres.toUpperCase();
            //apellidos = apellidos.toUpperCase();
            
            let nombresSplitted = nombres.split(' ');
            //let apellidosSplitted = apellidos.split(' ');
            let fechaDate = new Date(fecha);
            let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
            if(client.fecha){
                let nuevaFecha = cambiarFormatoFecha(client.fecha)
                fechaDate = new Date(nuevaFecha);
                mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
            }
            

            let toFill = {
                ...toFillBase,
                dia: fechaDate.getUTCDate(),
                mes: mesName,
                mesnum: fechaDate.getUTCMonth() + 1,
                anio: fechaDate.getFullYear(),  
                nombres: nombres,
                nombre: nombresSplitted[0],
                cc: cc
            };

            await generateQr(QRTemplateModule(nombres + ' ', cc, `${toFill.dia}/${toFill.mesnum}/${toFill.anio}`, chosenModule.modulo));

            const qrfile = fs.readFileSync('qr.png');

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
            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);
            
            fs.writeFileSync(`${resultModulePath}/${nombreEmpresa}/M${modulo}_${nombresSplitted[0]}_${toFill.mesnum}_${toFill.anio}_${cc}.pdf`, pdfBuf);
            
            contador++;
            global.send(contador + ' de ' + dataClient.length);
        }
        global.send('Ready');
        res.json({ msg: 'Modulos generados con éxito' });

    } catch (error) {
        console.error(error);
        global.send('Error');
    }
})

router.post('/certificado', async (req, res) => {
    // El código de tu ruta /certificado
    try {
        const { nombres, apellidos, cc, fecha} = req.body
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings()

        const { nombreFirma, tituloFirma, tarjetaProfesional, pathAnexo, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada)

        const filename = 'Plantilla.docx'
        let fechaDate = new Date(fecha)
        const nombresSplitted = nombres.split(' ')
        const apellidosSplitted = apellidos.split(' ')        
        let mesName = meses.find(mesObj => mesObj.id === (fechaDate.getUTCMonth() + 1)).name           
            
        let toFill = {
            nombres,
            apellidos,
            nombre: nombresSplitted[0],            
            apellido: apellidosSplitted[0],
            cc,
            dia: fechaDate.getUTCDate(),
            mes: mesName,
            mesnum:fechaDate.getUTCMonth() + 1,
            anio:fechaDate.getFullYear(),
            aniov: fechaDate.getFullYear() + 1,
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
            },
            anexo: {
                _type: 'image',
                source: getBuffer(pathAnexo),
                format: MimeType.Png,
                width: 673,
                height: 802
            }
        }
        
        await generateQr(QRTemplate(nombres + " " + apellidos, 
        cc, toFill.dia + "/" + toFill.mesnum + "/" + toFill.aniov))

        const headerExtension = new HeaderExtension();
        const handler = new TemplateHandler({
            extensions: {
                afterCompilation: [
                    headerExtension 
                ]
            }
        }); 
             
        
        let file = fs.readFileSync(folderPath + "/" + filename);
        let qrfile = fs.readFileSync("qr.png")
        let doc = await handler.process(file, {...toFill,
            qr: {_type: "image",
            source: qrfile,
            format: MimeType.Png,
            width: 115,
            height: 100        
            },
            qr2: {_type: "image",
            source: qrfile,
            format: MimeType.Png,
            width: 142,
            height: 142
        
        }})
        
        
        let pdfBuf = await libre.convertAsync(doc, '.pdf', undefined)

        fs.writeFileSync(resultPath + "/" 
        + `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`, pdfBuf)
        // Guardar PDF en disco
        const pdfFileName = `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`;
        const pdfFilePath = path.join(resultPath, pdfFileName);
        fs.writeFileSync(pdfFilePath, pdfBuf);

        // Convertir PDF a imágenes PNG usando Ghostscript
        const outputDir = path.join(resultPath, "images", path.parse(pdfFileName).name);
        fs.mkdirSync(outputDir, { recursive: true });

        const imagePaths = await convertPDFToPNG(pdfFilePath, outputDir);
        console.log("Imágenes generadas:", imagePaths);
        // Volver a convertir las imágenes en un PDF (si es necesario)
        const finalPdfPath = path.join(resultPath, `final_${pdfFileName}`);
        await convertImagesToPDF(imagePaths, finalPdfPath);
        res.status(200).json({msg: `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}${fechaDate.getFullYear()}-${cc}.pdf`})

        
        
    } catch (error) {
        console.log(error)
        if(error.errno == -4058){
            res.status(404).json({msg: 'Plantilla no se encuentra en la carpeta C:/Gemsap/'})
        }
        if(error.errno == -4051){
            res.status(404).json({msg: 'No se encontró Libre Office Instalado en el Sistema'})
        }else {
            res.status(404).json({msg: 'Contacte con su Administrador'})
        }        
    }
});
router.post('/bebidas', async (req, res) => {
    // El código de tu ruta /certificado
    try {
        const { nombres, apellidos, cc, fecha} = req.body
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings()

        const { nombreFirma, tituloFirma, tarjetaProfesional, pathAnexo, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada)

        const filename = 'PlantillaBebidas.docx'
        let fechaDate = new Date(fecha)
        const nombresSplitted = nombres.split(' ')
        const apellidosSplitted = apellidos.split(' ')        
        let mesName = meses.find(mesObj => mesObj.id === (fechaDate.getUTCMonth() + 1)).name           
            
        let toFill = {
            nombres,
            apellidos,
            nombre: nombresSplitted[0],            
            apellido: apellidosSplitted[0],
            cc,
            dia: fechaDate.getUTCDate(),
            mes: mesName,
            mesnum:fechaDate.getUTCMonth() + 1,
            anio:fechaDate.getFullYear(),
            aniov: fechaDate.getFullYear() + 1,
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
            },
            anexo: {
                _type: 'image',
                source: getBuffer(pathAnexo),
                format: MimeType.Png,
                width: 673,
                height: 802
            }
        }
        
        await generateQr(QRTemplateDrinks(nombres + " " + apellidos, 
        cc, toFill.dia + "/" + toFill.mesnum + "/" + toFill.aniov))

        const headerExtension = new HeaderExtension();
        const handler = new TemplateHandler({
            extensions: {
                afterCompilation: [
                    headerExtension 
                ]
            }
        }); 
             
        
        let file = fs.readFileSync(folderPath + "/" + filename);
        let qrfile = fs.readFileSync("qr.png")
        let doc = await handler.process(file, {...toFill,
            qr: {_type: "image",
            source: qrfile,
            format: MimeType.Png,
            width: 115,
            height: 100        
            },
            qr2: {_type: "image",
            source: qrfile,
            format: MimeType.Png,
            width: 142,
            height: 142
        
        }})
        
        
        let pdfBuf = await libre.convertAsync(doc, '.pdf', undefined)

        fs.writeFileSync(resultDrinksPath + "/" 
        + `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${cc}.pdf`, pdfBuf)
        
        res.status(200).json({msg: `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}${fechaDate.getFullYear()}-${cc}.pdf`})

        
        
    } catch (error) {
        console.log(error)
        if(error.errno == -4058){
            res.status(404).json({msg: 'Plantilla no se encuentra en la carpeta C:/Gemsap/'})
        }
        if(error.errno == -4051){
            res.status(404).json({msg: 'No se encontró Libre Office Instalado en el Sistema'})
        }else {
            res.status(404).json({msg: 'Contacte con su Administrador'})
        }        
    }
});

router.post('/carnets', async (req, res) => {
    try {
        const { nombreEmpresa } = req.body
        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings()
        const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada)

        const filenameDocx = 'PlantillaCarnets.docx'
        const filenameXlsx = 'Cargue_Carnets.xlsx'

        const handler = new TemplateHandler({}); 

        // Leer los archivos una vez fuera del bucle
        const file = fs.readFileSync(folderPath + '/' + filenameDocx);
        const plantillaX = reader.readFile(folderPath + '/' + filenameXlsx);
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);
        
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
            },
        };

        if (!fs.existsSync(cardsPath + '/' + nombreEmpresa)) {
            fs.mkdirSync(cardsPath + '/' + nombreEmpresa);
        }

        let contador = 1;
        global.send(contador + ' de ' + dataClient.length);

        let paquetes = dividirEnPaquetes(dataClient, 4)

        for(let index = 0; index < paquetes.length; index++ ) {
            
            let toFill = {
                ...toFillBase,
                dia0: '',
                dia1: '',
                dia2: '',
                dia3: '',
                mes0: '',
                mes1: '',
                mes2: '',
                mes3: '',
                aniov0: '',                    
                aniov1: '',                    
                aniov2: '',                    
                aniov3: '',                    
                nombre0: '',            
                nombre1: '',            
                nombre2: '',            
                nombre3: '',            
                apellido0: '',
                apellido1: '',
                apellido2: '',
                apellido3: '',
                cc0: '',
                cc1: '',
                cc2: '',
                cc3: '',
                qr0: '',
                qr1: '',
                qr2: '',
                qr3: ''
            };

            for (let i = 0; i < paquetes[index].length; i++) {

                let { nombres, apellidos, cc, fecha } = paquetes[index][i];

                nombres = nombres.toUpperCase();
                apellidos = apellidos.toUpperCase();
                
                let nombresSplitted = nombres.split(' ');
                let apellidosSplitted = apellidos.split(' ');
/*                 let fechaDate = new Date(fecha);
                let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name; */
                if(paquetes[index][i].fecha){
                    let nuevaFecha = cambiarFormatoFecha(fecha)
                    fechaDate = new Date(nuevaFecha);
                    mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
                }

                toFill[`nombre${i}`] = nombresSplitted[0]
                toFill[`apellido${i}`] = apellidosSplitted[0]
                toFill[`cc${i}`] = cc
                toFill[`dia${i}`] = fechaDate.getUTCDate()
                toFill[`mes${i}`] = mesName
                toFill[`aniov${i}`] = fechaDate.getFullYear() + 1 
                
                //Obtener Info                
                await generateQr(QRTemplate(nombres + ' ' + apellidos, cc, `${toFill[`dia${i}`]}/${toFill[`mes${i}`]}/${toFill[`aniov${i}`]}`));
                const qrfile = fs.readFileSync('qr.png');
                toFill[`qr${i}`] = {
                    _type: 'image',
                    source: qrfile,
                    format: MimeType.Png,
                    width: 106,
                    height: 106
                }
                contador++
                global.send(contador + ' de ' + dataClient.length);
            }
            const doc = await handler.process(file, {...toFill})
            console.log(toFill)
            const pdfBuf = await libre.convertAsync(doc, '.pdf', undefined);
            fs.writeFileSync(`${cardsPath}/${nombreEmpresa}/Paquete${index}.pdf`, pdfBuf);
            //console.log(toFill)
            //Generar Documento

        }


        global.send('Ready');
        res.json({ msg: 'Certificados generados con éxito' });


    } catch (error) {
        console.error(error);
        global.send('Error');
    }
})

router.post('/carguemasivo', async (req, res) => {
    // El código de tu ruta /carguemasivo
    try {
        const { nombreEmpresa, fecha } = req.body;

        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings()

        const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada)


        const filenameDocx = 'PlantillaSimple.docx';
        const filenameXlsx = 'Cargue_Masivo.xlsx';
        
        const handler = new TemplateHandler({}); 

        // Leer los archivos una vez fuera del bucle
        const file = fs.readFileSync(folderPath + '/' + filenameDocx);
        const plantillaX = reader.readFile(folderPath + '/' + filenameXlsx);
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // Crear objeto toFill una vez fuera del bucle
        
        
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
            },
        };

        if (!fs.existsSync(resultPath + '/' + nombreEmpresa)) {
            fs.mkdirSync(resultPath + '/' + nombreEmpresa);
        }

        let contador = 1;
        global.send(contador + ' de ' + dataClient.length);

        for (const client of dataClient) {
            let { nombres, apellidos, cc } = client;

            nombres = nombres.toUpperCase();
            apellidos = apellidos.toUpperCase();
            
            let nombresSplitted = nombres.split(' ');
            let apellidosSplitted = apellidos.split(' ');
            let fechaDate = new Date(fecha);
            let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
            if(client.fecha){
                let nuevaFecha = cambiarFormatoFecha(client.fecha)
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

            // Generar QR de forma asíncrona
            await generateQr(QRTemplate(nombres + ' ' + apellidos, cc, `${toFill.dia}/${toFill.mesnum}/${toFill.aniov}`));

            const qrfile = fs.readFileSync('qr.png');

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
            
            fs.writeFileSync(`${resultPath}/${nombreEmpresa}/${apellidosSplitted[0]}_${nombresSplitted[0]}_${toFill.mesnum}_${toFill.anio}_${cc}.pdf`, pdfBuf);
            
            contador++;
            global.send(contador + ' de ' + dataClient.length);
        }

        global.send('Ready');
        res.json({ msg: 'Certificados generados con éxito' });
    } catch (error) {
        console.error(error);
        global.send('Error');
    }
});

router.post('/masivobebidas', async (req, res) => {
    // El código de tu ruta /carguemasivo
    try {
        const { nombreEmpresa, fecha } = req.body;

        const { pathFirmaGemsap, firmaSeleccionada, firmas } = getSettings()

        const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma } = firmas.find(fir => fir.firma === firmaSeleccionada)


        const filenameDocx = 'PlantillaSimpleBebidas.docx';
        const filenameXlsx = 'Cargue_Masivo_Bebidas.xlsx';
        
        const handler = new TemplateHandler({}); 

        // Leer los archivos una vez fuera del bucle
        const file = fs.readFileSync(folderPath + '/' + filenameDocx);
        const plantillaX = reader.readFile(folderPath + '/' + filenameXlsx);
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // Crear objeto toFill una vez fuera del bucle
        
        
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
            },
        };

        if (!fs.existsSync(resultDrinksPath + '/' + nombreEmpresa)) {
            fs.mkdirSync(resultDrinksPath + '/' + nombreEmpresa);
        }

        let contador = 1;
        global.send(contador + ' de ' + dataClient.length);

        for (const client of dataClient) {
            let { nombres, apellidos, cc } = client;

            nombres = nombres.toUpperCase();
            apellidos = apellidos.toUpperCase();
            
            let nombresSplitted = nombres.split(' ');
            let apellidosSplitted = apellidos.split(' ');
            let fechaDate = new Date(fecha);
            let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
            if(client.fecha){
                let nuevaFecha = cambiarFormatoFecha(client.fecha)
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

            // Generar QR de forma asíncrona
            await generateQr(QRTemplateDrinks(nombres + ' ' + apellidos, cc, `${toFill.dia}/${toFill.mesnum}/${toFill.aniov}`));

            const qrfile = fs.readFileSync('qr.png');

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
            
            fs.writeFileSync(`${resultDrinksPath}/${nombreEmpresa}/${apellidosSplitted[0]}_${nombresSplitted[0]}_${toFill.mesnum}_${toFill.anio}_${cc}.pdf`, pdfBuf);
            
            contador++;
            global.send(contador + ' de ' + dataClient.length);
        }

        global.send('Ready');
        res.json({ msg: 'Certificados generados con éxito' });
    } catch (error) {
        console.error(error);
        global.send('Error');
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

function dividirEnPaquetes(array, tamañoPaquete) {
    let resultado = [];
    for (let i = 0; i < array.length; i += tamañoPaquete) {
        let paquete = array.slice(i, i + tamañoPaquete);
        resultado.push(paquete);
    }
    return resultado;
}

function cambiarFormatoFecha(fechaString) {
    if (!isNaN(fechaString)) {
        // Si es un número, asumir que es un número de serie de fecha y devolverlo tal como está
        return numeroASerieFecha(fechaString)
    }
    // Reemplazar "/" por "-"
    let fechaSinSlash = fechaString.replace(/\//g, '-');
    
    // Separar la fecha en partes: dd, mm, yyyy
    let partesFecha = fechaSinSlash.split('-');
    
    // Crear la nueva fecha con el formato yyyy-mm-dd
    let nuevaFecha = `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;
    
    return nuevaFecha;
}

function numeroASerieFecha(numero) {
    // Definir la fecha base de Excel (1 de enero de 1900)
    let fechaBase = new Date("1900-01-01");
    console.log(numero)
    // Calcular la fecha sumando el número de días (ajustado por el desplazamiento de 1 día) a la fecha base
    let fecha = new Date(fechaBase.getTime() + (numero - 1) * 24 * 60 * 60 * 1000);
    
    // Extraer el día, mes y año de la fecha
    let dia = fecha.getDate().toString().padStart(2, '0');
    let mes = (fecha.getMonth() + 1).toString().padStart(2, '0'); // Los meses en JavaScript van de 0 a 11
    let anio = fecha.getFullYear();
    
    // Crear la fecha en formato "dd/mm/yyyy"
    let fechaFormateada = `${dia}-${mes}-${anio}`;
    console.log(fechaFormateada)
    
    return fechaFormateada;
}

module.exports = router;