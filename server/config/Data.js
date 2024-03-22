const appModulePath = require('app-module-path')
const path = require('path')
const fs = require('fs')

appModulePath.addPath(`${__dirname}`)

const totalPerfiles = 4;

const folderPath = path.join('C:', 'Gemsap')
const resultPath = path.join(folderPath, 'Certificados')
const resultModulePath = path.join(folderPath, 'Modulos')
const signsFilePath = path.join(folderPath, 'Firmas')
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
if(!fs.existsSync(signsFilePath)){
    fs.mkdirSync(signsFilePath)
    for (let i = 0; i < totalPerfiles; i++) {
        const profilePath = path.join(signsFilePath, 'Perfil ' + (i + 1))
        fs.mkdirSync(profilePath)
    }    
}

if(!fs.existsSync(settingsFilePath)) {
    const defaultSettings = {
        nombreFirma: 'POR CAMBIAR Y/O REMOVER',
        pathFirmaGemsap: path.join(folderPath, 'Firma.png'), //Firma Default o de Carnét
        tituloFirma: 'POR CAMBIAR Y/O REMOVER',
        firmaSeleccionada: 2,
        modulos: [
            {
                modulo: 1,
                temas: 'Los Alimentos y los microorganismos- Seguridad de los alimentos- Buenas prácticas de manufactura',
                horas: 10
            }, 
            {
                modulo: 2,
                temas: 'Higiene alimentaria - Seguridad en la cocina - Control de contaminantes',
                horas: 10
            }, 
            {
                modulo: 3,
                temas: 'Conservación de alimentos - Cadena de frío - Almacenamiento adecuado',
                horas: 10
            }
        ],
        firmas: [
            {
                firma: 1,
                nombreFirma: 'RAFAEL ALBERTO ORJUELA',
                tituloFirma: 'Profesional Capacitador',
                tarjetaProfesional: 'Esp. Sistemas de Calidad e Inocuidad en Alimentos',
                pathFirma: path.join(signsFilePath, 'Perfil 1//Firma.png'),
                pathAnexo: path.join(signsFilePath, 'Perfil 1//Anexo.png')
            },
            {
                firma: 2,
                nombreFirma: 'JASLEIDY ANDREA ROCHA',
                tituloFirma: 'Profesional Ingeniera de Alimentos',
                tarjetaProfesional: '223669420-4',
                pathFirma: path.join(signsFilePath, 'Perfil 2//Firma.png'),
                pathAnexo: path.join(signsFilePath, 'Perfil 2//Anexo.png')
            },
            {
                firma: 3,
                nombreFirma: 'SIN INFO',
                tituloFirma: 'SIN INFO',
                tarjetaProfesional: 'SIN INFO',
                pathFirma: path.join(signsFilePath, 'Perfil 3//Firma.png'),
                pathAnexo: path.join(signsFilePath, 'Perfil 3//Anexo.png')
            },
            {
                firma: 4,
                nombreFirma: 'SIN INFO',
                tituloFirma: 'SIN INFO',
                tarjetaProfesional: 'SIN INFO',
                pathFirma: path.join(signsFilePath, 'Perfil 4//Firma.png'),
                pathAnexo: path.join(signsFilePath, 'Perfil 4//Anexo.png')
            },
        ]
    }
    fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2))
}

const getSettings = () => {
    const settingsFileBuffer = fs.readFileSync(settingsFilePath)
    return JSON.parse(settingsFileBuffer.toString());
}

const saveSettings = (newSettings) => {
    const jsonSettings = JSON.stringify(newSettings, null, 2)
    try {
        fs.writeFileSync(settingsFilePath, jsonSettings);
        console.log('Ajustes guardados correctamente.');
    } catch (error) {
        console.error('Error al guardar los ajustes:', error);
    }
}

const getBuffer = (path) => {
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

module.exports = { folderPath, resultPath, settingsFilePath, resultModulePath, meses, getSettings, getBuffer, saveSettings }