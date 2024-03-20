
const http = require('http')
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x')

//const QRCode = require('qrcode')
const routes = require('./routes');

/* let QRTemplate = (nombreCompleto, documento, fechaFin) => {
return `GEMSAP Certifica Que ${nombreCompleto}, Con Documento ${documento}. Asistió Al Curso De Manipulación Higiénica De Alimentos y BPM. Vàlido Hasta ${fechaFin}
    `
} */

const libre = require('libreoffice-convert');
const { folderPath, resultPath } = require('./config/Data')
libre.convertAsync = require('util').promisify(libre.convert);
require('./config/WebSocket')




const Api = express();
const HTTP = http.Server(Api);



Api.use(cors());
Api.use(express.json({extended: true}))
Api.use('/', routes)
  

/* const generateQr = async (templateQr) => {
    var opts = {
        errorCorrectionLevel: 'H',
        type: 'image/jpeg',
        quality: 0.1,
                    
      }
    try {
       await QRCode.toFile('qr.png', templateQr, opts)
        
    } catch (error) {
        console.log(error)
    }

} */
/* 
Api.post('/certificado', async (req, res) => {

    try {
        const { nombres, apellidos, cc, fecha} = req.body

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
            aniov: fechaDate.getFullYear() + 1
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
            width: 100,
            height: 100        
            },
            qr2: {_type: "image",
            source: qrfile,
            format: MimeType.Png,
            width: 140,
            height: 140
        
        }})
        
        
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
); */
 
/* Api.post('/carguemasivo', async (req, res) => {
    try {
        const { nombreEmpresa, fecha } = req.body;

        const filenameDocx = 'PlantillaSimple.docx';
        const filenameXlsx = 'Cargue_Masivo.xlsx';
        const reader = require('xlsx');
        const handler = new TemplateHandler({}); 

        // Leer los archivos una vez fuera del bucle
        const file = fs.readFileSync(folderPath + '/' + filenameDocx);
        const plantillaX = reader.readFile(folderPath + '/' + filenameXlsx);
        const clientsSheet = plantillaX.Sheets['data'];
        const dataClient = reader.utils.sheet_to_json(clientsSheet);

        // Crear objeto toFill una vez fuera del bucle
        const fechaDate = new Date(fecha);
        const mesName = meses.find(mesObj => mesObj.id === fechaDate.getUTCMonth() + 1).name;
        
        const toFillBase = {
            dia: fechaDate.getUTCDate(),
            mes: mesName,
            mesnum: fechaDate.getUTCMonth() + 1,
            anio: fechaDate.getFullYear(),
            aniov: fechaDate.getFullYear() + 1
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
            
            let toFill = {
                ...toFillBase,
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
                    width: 100,
                    height: 100
                },
                qr2: {
                    _type: 'image',
                    source: qrfile,
                    format: MimeType.Png,
                    width: 140,
                    height: 140
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
}); */



//PRODUCTION
process.on('uncaughtException', (err) => {
    console.error(err);
    console.log("Node NOT Exiting...");    
  });

HTTP.listen(9001, () => {
    console.log('listening on *:9001');
});



