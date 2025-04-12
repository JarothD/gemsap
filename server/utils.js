const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const { convertImagesToPDF, convertPDFToPNG } = require('./config/Ghostscript');
const { /* TemplateHandler, TemplateExtension, */ MimeType } = require('easy-template-x');

const { /* folderPath, resultPath, resultDrinksPath, cardsPath,  */meses, /* getSettings, */ getBuffer/* , resultModulePath, saveSettings */ } = require('./config/Data');

const QRTemplate = (nombreCompleto, documento, fechaFin) => {
    return `GEMSAP Certifica Que ${nombreCompleto}, Con Número de Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}. Mayor Información Al WhatsApp 3107089494.`
};


function createToFill(data, firmaData, fecha, extras = {}) {
    const { nombres, apellidos, cc } = data;
    const { nombreFirma, tituloFirma, tarjetaProfesional, pathFirma, pathFirmaGemsap, pathAnexo } = firmaData;

    const nombresSplitted = nombres.split(' ');
    const apellidosSplitted = apellidos.split(' ');
    const fechaDate = new Date(fecha);
    const mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;

    return {
        nombres,
        apellidos,
        nombre: nombresSplitted[0],
        apellido: apellidosSplitted[0],
        cc,
        dia: fechaDate.getUTCDate(),
        mes: mesName,
        mesnum: fechaDate.getUTCMonth() + 1,
        anio: fechaDate.getFullYear(),
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
        },
        ...extras
    };
}

function createToFillForCards(toFillBase, maxCards = 4) {
    let toFill = {
        ...toFillBase
    };

    // Agregar campos dinámicos para cada tarjeta
    for (let i = 0; i < maxCards; i++) {
        toFill = {
            ...toFill,
            [`dia${i}`]: '',
            [`mes${i}`]: '',
            [`aniov${i}`]: '',
            [`nombre${i}`]: '',
            [`apellido${i}`]: '',
            [`cc${i}`]: '',
            [`qr${i}`]: ''
        };
    }

    return toFill;
}

// Agregar la función para procesar un paquete de tarjetas
async function processCardPackage(paquete, toFillBase, QRTemplate) {
    const toFill = createToFillForCards(toFillBase);

    for (let i = 0; i < paquete.length; i++) {
        let { nombres, apellidos, cc, fecha } = paquete[i];
        nombres = nombres.toUpperCase();
        apellidos = apellidos.toUpperCase();
        
        const nombresSplitted = nombres.split(' ');
        const apellidosSplitted = apellidos.split(' ');
        let fechaDate = new Date();
        let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;

        if (fecha) {
            const nuevaFecha = cambiarFormatoFecha(fecha);
            fechaDate = new Date(nuevaFecha);
            mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
        }

        toFill[`nombre${i}`] = nombresSplitted[0];
        toFill[`apellido${i}`] = apellidosSplitted[0];
        toFill[`cc${i}`] = cc;
        toFill[`dia${i}`] = fechaDate.getUTCDate();
        toFill[`mes${i}`] = mesName;
        toFill[`aniov${i}`] = fechaDate.getFullYear() + 1;

        // Generar QR
        await generateQr(QRTemplate(nombres + ' ' + apellidos, cc, 
            `${toFill[`dia${i}`]}/${toFill[`mes${i}`]}/${toFill[`aniov${i}`]}`));
        
        const qrfile = readTemplateFile("qr.png");
        toFill[`qr${i}`] = {
            _type: 'image',
            source: qrfile,
            format: MimeType.Png,
            width: 106,
            height: 106
        };
    }

    return toFill;
}

async function generateAndReadQr(template, outputPath = 'qr.png') {
    const opts = {
        errorCorrectionLevel: 'M',
        type: 'image/jpeg',
        quality: 0.9,
    };

    await QRCode.toFile(outputPath, template, opts);
    return fs.readFileSync(outputPath);
}

async function processPdfWithImages(pdfFilePath, outputDir) {
    console.time('Procesar PDF con imágenes');
    fs.mkdirSync(outputDir, { recursive: true });

    const imagePaths = await convertPDFToPNG(pdfFilePath, outputDir);
    //console.log("Imágenes generadas:", imagePaths);

    await convertImagesToPDF(imagePaths, pdfFilePath);

    // Eliminar las imágenes generadas
    for (const imagePath of imagePaths) {
        try {
            fs.unlinkSync(imagePath);
        } catch (err) {
            console.error(`Error al eliminar la imagen ${imagePath}:`, err);
        }
    }

    // Intentar eliminar la carpeta de imágenes
    try {
        fs.rmSync(outputDir, { recursive: true, force: true });
        //console.log(`Carpeta ${outputDir} eliminada correctamente.`);
    } catch (err) {
        console.error(`Error al eliminar la carpeta ${outputDir}:`, err);
    }
    console.timeEnd('Procesar PDF con imágenes');
}

function handleError(res, error) {
    console.error(error);
    if (error.errno === -4058) {
        res.status(404).json({ msg: 'Plantilla no se encuentra en la carpeta C:/Gemsap/' });
    } else if (error.errno === -4051) {
        res.status(404).json({ msg: 'No se encontró Libre Office Instalado en el Sistema' });
    } else {
        res.status(404).json({ msg: 'Contacte con su Administrador' });
    }
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function readTemplateFile(filePath) {
    return fs.readFileSync(filePath);
}

const generateQr = async (templateQr) => {
    const opts = {
        errorCorrectionLevel: 'M',
        type: 'image/jpeg',
        quality: 0.9,
    };

    console.time('Generar QR');
    try {
        await QRCode.toFile('qr.png', templateQr, opts);
    } catch (error) {
        console.error(error);
    }
    console.timeEnd('Generar QR');
};

// Agregar nueva función
async function generateQrBatch(clients, fecha, outputDir) {
    console.time('Generación batch QRs');
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const qrPromises = clients.map((client, index) => {
        const { nombres, apellidos, cc } = client;
        const fechaDate = new Date(client.fecha || fecha);
        const dia = fechaDate.getUTCDate();
        const mes = fechaDate.getUTCMonth() + 1;
        const anioV = fechaDate.getFullYear() + 1;

        const qrText = QRTemplate(
            `${nombres.toUpperCase()} ${apellidos.toUpperCase()}`,
            cc,
            `${dia}/${mes}/${anioV}`
        );

        const qrPath = path.join(outputDir, `qr_${index}_${cc}.png`);
        return QRCode.toFile(qrPath, qrText, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.9,
        }).then(() => ({
            index,
            cc,
            path: qrPath
        }));
    });

    const results = await Promise.all(qrPromises);
    console.timeEnd('Generación batch QRs');
    
    return results;
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
        return numeroASerieFecha(fechaString)
    }
    let fechaSinSlash = fechaString.replace(/\//g, '-');
    let partesFecha = fechaSinSlash.split('-');
    let nuevaFecha = `${partesFecha[2]}-${partesFecha[1]}-${partesFecha[0]}`;
    return nuevaFecha;
}

function numeroASerieFecha(numero) {
    let fechaBase = new Date("1900-01-01");
    let fecha = new Date(fechaBase.getTime() + (numero - 1) * 24 * 60 * 60 * 1000);
    let dia = fecha.getDate().toString().padStart(2, '0');
    let mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    let anio = fecha.getFullYear();
    let fechaFormateada = `${dia}-${mes}-${anio}`;
    return fechaFormateada;
}

module.exports = { 
    createToFill, 
    createToFillForCards, 
    processCardPackage, 
    generateAndReadQr, 
    processPdfWithImages, 
    handleError, 
    ensureDirectoryExists, 
    readTemplateFile, 
    generateQr, 
    generateQrBatch,
    dividirEnPaquetes, 
    cambiarFormatoFecha, 
    numeroASerieFecha 
};