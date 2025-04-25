import Swal from 'sweetalert2'

import { clienteAxios } from "../../config/axios";

const textButton = 'Ver en Carpeta'
// Función modularizada para abrir directorios
export function abrirDirectorio(outputDir) {
    if (!outputDir) {
        console.warn('No se recibió ruta de directorio para abrir');
        return false;
    }
    
    console.log("Verificando disponibilidad para abrir directorio...");
    console.log("Output directory:", outputDir);
    
    if (typeof window === 'undefined') {
        console.warn('Ventana no disponible para abrir directorio');
        return false;
    }
    
    console.log("ElectronAPI disponible:", !!window.electronAPI);
    console.log("OpenDirectory disponible:", typeof window.electronAPI?.openDirectory === 'function');
    
    if (!window.electronAPI || typeof window.electronAPI.openDirectory !== 'function') {
        console.warn('No se pudo abrir el directorio: API de Electron no disponible correctamente');
        return false;
    }
    
    try {
        // Verificar si outputDir es una ruta a un archivo PDF
        const esPDF = typeof outputDir === 'string' && outputDir.toLowerCase().endsWith('.pdf');
        
        if (esPDF) {
            console.log("Es un archivo PDF:", outputDir);
            
            // Extraer el directorio del PDF en caso de que el archivo no exista
            const lastSeparatorIndex = Math.max(
                outputDir.lastIndexOf('/'), 
                outputDir.lastIndexOf('\\')
            );
            
            let dirPath = outputDir;
            if (lastSeparatorIndex > 0) {
                dirPath = outputDir.substring(0, lastSeparatorIndex);
            }
            
            // Intentar abrir el PDF con selección
            return window.electronAPI.openDirectory(outputDir)
                .then(() => {
                    console.log("Archivo PDF abierto con selección");
                    return true;
                })
                .catch(err => {
                    console.error("Error al abrir archivo PDF:", err);
                    // Si falla al abrir el archivo, intentar abrir solo el directorio padre
                    console.log("Intentando abrir el directorio padre:", dirPath);
                    return window.electronAPI.openDirectory(dirPath)
                        .then(() => {
                            console.log("Directorio padre abierto con éxito");
                            return true;
                        })
                        .catch(err2 => {
                            console.error("Error al abrir directorio padre:", err2);
                            return false;
                        });
                });
        }
        
        // Si no es PDF, comportamiento normal
        console.log("Intentando abrir directorio:", outputDir);
        return window.electronAPI.openDirectory(outputDir)
            .then(() => {
                console.log("Directorio abierto con éxito");
                return true;
            })
            .catch(err => {
                console.error("Error al abrir directorio:", err);
                return false;
            });
    } catch (error) {
        console.error("Error al intentar abrir directorio:", error);
        return false;
    }
}

export async function llenarDocx(data, type){            
    try {        
        const {nombres, apellidos, cc, fecha} = data

        if(type === 'Alimentos'){
            const respuesta = await clienteAxios.post('/certificado', {
                nombres: nombres.toUpperCase(),
                apellidos: apellidos.toUpperCase(),
                cc,
                fecha
            })
            
            Swal.fire({
                icon:'success',
                title:'Éxito',
                text: 'Certificado ' + respuesta.data.msg + ' creado con éxito',
                confirmButtonText: textButton
            }).then(() => {
                // Usar la función modularizada para abrir el directorio
                if (respuesta.data.outputDir) {
                    abrirDirectorio(respuesta.data.outputDir);
                }
            }, 100);
        }
        if(type === 'Bebidas'){
            const respuesta = await clienteAxios.post('/bebidas', {
                nombres: nombres.toUpperCase(),
                apellidos: apellidos.toUpperCase(),
                cc,
                fecha
            })
            
            Swal.fire({
                icon:'success',
                title:'Éxito',
                text: 'Certificado ' + respuesta.data.msg + ' creado con éxito',
                confirmButtonText: textButton
            }).then(() => {
                // Usar la función modularizada para abrir el directorio
                if (respuesta.data.outputDir) {
                    abrirDirectorio(respuesta.data.outputDir);
                }
            }, 100);
        }
        
    } catch (error) {
        
        if(error.name == 'AxiosError'){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: 'LibreOffice no esta Instalado'
            })            
        }
        if(error.response.data.msg){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: error.response.data.msg
            })
        } 
        
    }        
}


export async function generarCarnets(data){
    try {
        const { nombreEmpresa } = data

        const respuesta = await clienteAxios.post('/carnets', {
            nombreEmpresa: nombreEmpresa.toUpperCase(),
            
        })
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: respuesta.data.msg,
            confirmButtonText: textButton
        }).then(() => {
            // Usar la función modularizada para abrir el directorio
            if (respuesta.data.outputDir) {
                abrirDirectorio(respuesta.data.outputDir);
            }
        }, 100);

        
        
    } catch (error) {
        if(error.name == 'AxiosError'){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: 'LibreOffice no esta Instalado'
            })            
        }
        if(error.response.data.msg){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: error.response.data.msg
            })
        }
    }
}
export async function cargueMasivo(data){
    try {
        const {nombreEmpresa, fecha} = data

        const respuesta = await clienteAxios.post('/carguemasivo', {
            nombreEmpresa: nombreEmpresa.toUpperCase(),
            fecha
        })
        
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: respuesta.data.msg,
            confirmButtonText: textButton
        }).then(() => {
            // Usar la función modularizada para abrir el directorio
            if (respuesta.data.outputDir) {
                abrirDirectorio(respuesta.data.outputDir);
            }
        }, 100);
        
    } catch (error) {
        if(error.name == 'AxiosError'){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: 'LibreOffice no esta Instalado'
            })            
        }
        if(error.response.data.msg){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: error.response.data.msg
            })
        }
    }
}
export async function cargueCarnets(data){
    try {
        const { nombreEmpresa } = data

        const respuesta = await clienteAxios.post('/carnets', {
            nombreEmpresa: nombreEmpresa.toUpperCase()
            
        })
        
        // Close any open SweetAlert and show success message with OK button
        Swal.close();
        setTimeout(() => {
            Swal.fire({
                icon:'success',
                title:'Éxito',
                text: respuesta.data.msg,
                confirmButtonText: textButton
            }).then(() => {
                // Usar la función modularizada para abrir el directorio
                if (respuesta.data.outputDir) {
                    abrirDirectorio(respuesta.data.outputDir);
                }
            });
        }, 100);

        
        
    } catch (error) {
        if(error.name == 'AxiosError'){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: 'LibreOffice no esta Instalado'
            })            
        }
        if(error.response.data.msg){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: error.response.data.msg
            })
        }
    }
}

export async function cargueMasivoBebidas(data){
    try {
        const { nombreEmpresa, fecha  } = data

        const respuesta = await clienteAxios.post('/masivobebidas', {
            nombreEmpresa: nombreEmpresa.toUpperCase(),
            fecha
        });
        
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: respuesta.data.msg,
            confirmButtonText: textButton
        }).then(() => {
            // Usar la función modularizada para abrir el directorio
            if (respuesta.data.outputDir) {
                abrirDirectorio(respuesta.data.outputDir);
            }
        }, 100);
        
    } catch (error) {
        if(error.name == 'AxiosError'){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: 'LibreOffice no esta Instalado'
            })            
        }
        if(error.response && error.response.data && error.response.data.msg){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: error.response.data.msg
            })
        }
    }
}


export async function cargueModular(data) {
    try {
        const { nombreEmpresa, modulo, fecha } = data

        const respuesta = await clienteAxios.post('/modulos', {
            nombreEmpresa: nombreEmpresa.toUpperCase(),
            modulo,
            fecha

        })
        
        // Close any open SweetAlert and show success message with OK button
        Swal.close();
        setTimeout(() => {
            Swal.fire({
                icon:'success',
                title:'Éxito',
                text: respuesta.data.msg,
                confirmButtonText: textButton
            }).then(() => {
                // Usar la función modularizada para abrir el directorio
                if (respuesta.data.outputDir) {
                    abrirDirectorio(respuesta.data.outputDir);
                }
            });
        }, 100);
    } catch (error) {
        if(error.name == 'AxiosError'){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: 'LibreOffice no esta Instalado'
            })            
        }
        if(error.response.data.msg){
            Swal.fire({
                icon:'error',
                title:'Ooops..',
                text: error.response.data.msg
            })
        }
    }
}