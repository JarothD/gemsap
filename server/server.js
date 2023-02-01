const appModulePath = require('app-module-path')
const http = require('http')
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const { TemplateHandler, TemplateExtension } = require('easy-template-x')

const libre = require('libreoffice-convert');
libre.convertAsync = require('util').promisify(libre.convert);
require('./config/WebSocket')

appModulePath.addPath(`${__dirname}`)

const path = require('path')
const Api = express();
const HTTP = http.Server(Api);


const folderPath = path.join('C:', 'Gemsap')
const resultPath = path.join(folderPath, 'Certificados')

if(!fs.existsSync(folderPath)){
    fs.mkdirSync(folderPath)
}

if(!fs.existsSync(resultPath)){
    fs.mkdirSync(resultPath)
}
Api.use(cors());
Api.use(express.json({extended: true}))

Api.post('/certificado', async (req, res) => {

    try {
        const { nombres, apellidos, cc, fecha} = req.body

        const filename = 'Plantilla.docx'
        let fechaDate = new Date(fecha)
        const nombresSplitted = nombres.split(' ')
        const apellidosSplitted = apellidos.split(' ')        
        let mesName = meses.find(mesObj => mesObj.id === (fechaDate.getUTCMonth() + 1)).name
            //console.log(fechaDate)
            //console.log(fechaDate.getUTCDate())
            //console.log(fechaDate.getUTCMonth() + 1)
            //console.log(fechaDate.getMonth() + 1)
            //console.log(fechaDate.getFullYear())           

            
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
            aniov: fechaDate.getFullYear() + 1
        }

        const headerExtension = new HeaderExtension();
        const handler = new TemplateHandler({
            extensions: {
                afterCompilation: [
                    headerExtension 
                ]
            }
        });
        //console.log(toFill)
        const file = fs.readFileSync(folderPath + "/" + filename);
        let doc = await handler.process(file, toFill)                
        let pdfBuf = await libre.convertAsync(doc, '.pdf', undefined)

        fs.writeFileSync(resultPath + "/" 
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
    }
);

Api.post('/carguemasivo', async (req, res) => {
    
    try {
        const { nombreEmpresa, fecha } = req.body

        const filenameDocx = 'PlantillaSimple.docx'
        const filenameXlsx = 'Cargue_Masivo.xlsx'
        const reader = require('xlsx')
        
        

        if(!fs.existsSync(resultPath + "/" + nombreEmpresa)){
            fs.mkdirSync(resultPath + "/" + nombreEmpresa)
        }
        
        let fechaDate = new Date(fecha)
        let mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name
        let file = fs.readFileSync(folderPath + "/" + filenameDocx);
        const plantillaX = reader.readFile(folderPath + "/" + filenameXlsx)
        const clientsSheet = plantillaX.Sheets['data']
        const dataClient = reader.utils.sheet_to_json(clientsSheet)        
        let contador = 1;
        global.send(contador + ' de ' + dataClient.length)
        

        for(let client of dataClient){
            
            let {nombres, apellidos} = client

            nombres = nombres.toUpperCase()
            apellidos = apellidos.toUpperCase()
            
            let nombresSplitted = nombres.split(' ')
            let apellidosSplitted = apellidos.split(' ')
            let toFill = {
                nombres: nombres,
                apellidos: apellidos,
                nombre: nombresSplitted[0],            
                apellido: apellidosSplitted[0],
                cc: client.cc,
                dia: fechaDate.getUTCDate(),
                mes: mesName,
                mesnum:fechaDate.getUTCMonth() + 1,
                anio:fechaDate.getFullYear(),
                aniov: fechaDate.getFullYear() + 1
            }
            const headerExtension = new HeaderExtension();
            const handler = new TemplateHandler(/* {
                extensions: {
                    afterCompilation: [
                        headerExtension 
                    ]
                }
            } */)
            let doc = await handler.process(file, toFill)
            //console.log(doc)
            let pdfBuf = await libre.convertAsync(doc, '.pdf', undefined)
            fs.writeFileSync(resultPath + "/" + nombreEmpresa + "/"
        + `${apellidosSplitted[0]}_${nombresSplitted[0]}_${fechaDate.getUTCMonth() + 1}_${fechaDate.getFullYear()}_${client.cc}.pdf`, pdfBuf)
        contador++
        global.send(contador + ' de ' + dataClient.length)

        }
        global.send('Ready')
        res.json({msg: 'Certificados generados con éxito'})
    } catch (error) {
        console.log(error)
        global.send('Error')
    }

})



//PRODUCTION
process.on('uncaughtException', (err) => {
    console.error(err);
    console.log("Node NOT Exiting...");    
  });

HTTP.listen(9001, () => {
    console.log('listening on *:9001');
});

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