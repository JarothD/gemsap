const appModulePath = require('app-module-path')
const path = require('path')
const fs = require('fs')

appModulePath.addPath(`${__dirname}`)

const folderPath = path.join('C:', 'Gemsap')
const resultPath = path.join(folderPath, 'Certificados')
const resultModulePath = path.join(folderPath, 'Modulos')
const settingsFilePath = path.join(folderPath, 'settings.json')

if(!fs.existsSync(folderPath)){
    fs.mkdirSync(folderPath)
}

if(!fs.existsSync(resultPath)){
    fs.mkdirSync(resultPath)
}
if(!fs.existsSync(resultModulePath)){
    fs.mkdirSync(resultModulePath)
}

if(!fs.existsSync(settingsFilePath)) {
    const defaultSettings = {
        nombreFirma: 'JASLEIDY ANDREA ROCHA',
        pathFirma: path.join(folderPath, 'Firma.png'),
        tituloFirma: 'Profesional Ingeniera de Alimentos',
        modulos: [{
            modulo: 1,
            temas: 'Los Alimentos y los microorganismos- Seguridad de los alimentos- Buenas prácticas de manufactura',
            horas: 10
        }, {
            modulo: 2,
            temas: 'Higiene alimentaria - Seguridad en la cocina - Control de contaminantes',
            horas: 10
        }, {
            modulo: 3,
            temas: 'Conservación de alimentos - Cadena de frío - Almacenamiento adecuado',
            horas: 10
        }]
    }
    fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2))
}

const getSettings = () => {
    const settingsFileBuffer = fs.readFileSync(settingsFilePath)
    return JSON.parse(settingsFileBuffer.toString());
}

const getFirmaBuffer = (path) => {
    return fs.readFileSync(path)
}


const meses = [
    {id: 1, name: 'Enero'}, 
    {id: 2, name: 'Febrero'},
    {id: 3, name: 'Marzo'},
    {id: 4, name: 'Abril'},
    {id: 5, name: 'Mayo'},
    {id: 6, name: 'Junio'},
    {id: 7, name: 'Julio'},
    {id: 8, name: 'Agosto'},
    {id: 9, name: 'Septiembre'},
    {id: 10, name: 'Octubre'},
    {id: 11, name: 'Noviembre'},
    {id: 12, name: 'Diciembre'},
    ]

module.exports = { folderPath, resultPath, settingsFilePath, resultModulePath, meses, getSettings, getFirmaBuffer }