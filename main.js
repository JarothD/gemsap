const {app, BrowserWindow, ipcMain} = require("electron");

const fs = require("fs")
const path = require("path");
const url = require('url')
const isDev = require("electron-is-dev");


let mainWindow;

function createWindow() {

  if(!isDev){
    require(path.join(__dirname, 'build-server/server.js'));
  }
  console.log(path.join(__dirname, "preload.js"))
  mainWindow = new BrowserWindow({ 
    width: 800, 
    height: 680,
    minHeight: 800,
    minWidth: 600,
    //frame:false, 
    webPreferences: { 
      frame: false,
      nodeIntegration: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js") // add "preload" 

    }});    
    //mainWindow.removeMenu()
  mainWindow.loadURL(
    
    isDev ? "http://localhost:3000": url.format({
        pathname: path.join(__dirname, 'build/index.html'),
        protocol: 'file:',
        slashes: true
    })    
    );
    mainWindow.webContents.openDevTools()  
  mainWindow.on("closed", () => (mainWindow = null));
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
  
});
