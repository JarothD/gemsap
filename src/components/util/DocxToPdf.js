import { clienteAxios } from "../../config/axios";
import Swal from 'sweetalert2'

export async function llenarDocx(data){            
    try {        
        const {nombres, apellidos, cc, fecha} = data

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

        
        
    } catch (error) {
        
    }
}