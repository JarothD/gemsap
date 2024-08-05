
const http = require('http')
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const { TemplateHandler, TemplateExtension, MimeType } = require('easy-template-x')

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

HTTP.listen(9001, () => {
    console.log('listening on *:9001');
});



