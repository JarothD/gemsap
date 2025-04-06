const { /* TemplateHandler, TemplateExtension, */ MimeType } = require('easy-template-x');

const { /* folderPath, resultPath, resultDrinksPath, cardsPath,  */meses, /* getSettings, */ getBuffer/* , resultModulePath, saveSettings */ } = require('./config/Data');

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

module.exports = { createToFill}