
const http = require('http')
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x')
const { checkGhostscript } = require('./config/Ghostscript')

const routes = require('./routes');
const libre = require('libreoffice-convert');
const { folderPath, resultPath } = require('./config/Data')
libre.convertAsync = require('util').promisify(libre.convert);
require('./config/WebSocket')

const Api = express();
const HTTP = http.Server(Api);

Api.use(cors());
Api.use(express.json({extended: true}))
Api.use('/', routes)

//PRODUCTION
process.on('uncaughtException', (err) => {
    console.error(err);
    console.log("Node NOT Exiting...");    
  });

  async function startServer() {
    try {
      await checkGhostscript(); // Asegura que Ghostscript está funcionando antes de arrancar
      HTTP.listen(9001, () => {
        console.log("listening on *:9001");
      });
    } catch (error) {
      console.error("Error: Ghostscript no está disponible. El servidor no se iniciará.");
      process.exit(1); // Detener la ejecución si Ghostscript no funciona
    }
  }
  
  startServer();

