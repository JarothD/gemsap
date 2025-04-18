import Swal from 'sweetalert2'

import { clienteAxios } from "../../config/axios";

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
                text: 'Certificado ' + respuesta.data.msg + ' creado con éxito'
            })

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
                text: 'Certificado ' + respuesta.data.msg + ' creado con éxito'
            })

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
            didOpen: () => {
                Swal.hideLoading()
              }
        })

        
        
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
            didOpen: () => {
                Swal.hideLoading()
              }
        })
        return respuesta.data.outputDir

        
        
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
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: respuesta.data.msg,
            didOpen: () => {
                Swal.hideLoading()
              }
        })

        
        
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
        })
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: respuesta.data.msg,
            didOpen: () => {
                Swal.hideLoading()
              }
        })

        
        
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


export async function cargueModular(data) {
    try {
        const { nombreEmpresa, modulo, fecha } = data

        const respuesta = await clienteAxios.post('/modulos', {
            nombreEmpresa: nombreEmpresa.toUpperCase(),
            modulo,
            fecha

        })
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: respuesta.data.msg,
            didOpen: () => {
                Swal.hideLoading()
              }
        })
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