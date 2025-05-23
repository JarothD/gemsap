import React, { useState } from 'react'
import Swal from 'sweetalert2'

import { cargueCarnets } from '../util/DocxToPdf';
import wss from '../../config/wss'
import NavMenu from '../util/NavMenu';

const Carnets = () => {

    const actualPage = 'Carnets'
    
    // Función para validar que un campo solo contiene texto y espacios
    const soloTexto = (texto) => {
        return /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(texto);
    }
    
    // Función para validar texto de empresa (permite más caracteres)
    const textoEmpresa = (texto) => {
        // Permite letras, números, espacios, puntos, comas, guiones, &, #, y otros símbolos comunes
        // Excluye caracteres peligrosos como {}, [], <>, etc.
        return /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ0-9\s\.\,\-\_\'\"\&\#\@\!\?\:\;\+\*\/\=\%\$\|\(\)]+$/.test(texto);
    }
    
    wss.onmessage = (event) => {

        if(event.data === 'Ready'){
            setCargando('Cargando...')
        } 
        else if(event.data === 'Error'){
            Swal.fire({
                icon:'error',
                title:'Oops...',
                text: 'Verifique la existencia de Cargue_Masivo.xlsx y PlantillaSimple.docx',
                didOpen: () => {
                    Swal.hideLoading()
                  }
            })
            wss.send('Ready')

        }
        
        else {
            
            setCargando(event.data)
            
            Swal.fire({
                title: 'Generando Certificado',
                html: cargando,
                allowEscapeKey: false,
                allowOutsideClick: false,
                didOpen: () => {
                  Swal.showLoading()
                }
              })


        }  
      }

    let fechaActual = new Date()
    let anio = fechaActual.getFullYear(),
        mes = fechaActual.getMonth() + 1,
        dia = fechaActual.getDate()
    if(dia < 10){
        dia = '0'+ dia;
    }                //YYYY-mm-dd
    if(mes <10){
        mes = '0' + mes;
    }
    let format = anio + "-" + mes + "-" + dia    

    const [datos, setDatos] = useState({
        nombreEmpresa: '',
        fecha: format
    })

    const [cargando, setCargando] = useState('Cargando...')

    const onSubmit = async e => {
        e.preventDefault();
        Swal.fire({
            title: 'Generando Certificado',
            html: 'Cargando...',
            allowEscapeKey: false,
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading()
            }
          });
        try {
            if(datos.nombreEmpresa.length < 2){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'Nombre de Empresa debe tener más de 2 caracteres',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })
                return;  
            }
            if(!textoEmpresa(datos.nombreEmpresa)){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'El nombre de empresa contiene caracteres no permitidos',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })
                return;
            }
            cargueCarnets(datos)
        } catch (error) {
            console.log(error)
            Swal.fire({
                icon:'error',
                title:'Ooops',
                text: 'Algo ha sucedido...' 
            })
        }

    }




    const onChange = e => {
        const { name, value } = e.target;
        
        // Si es el campo nombreEmpresa y no está vacío, validar con reglas específicas
        if (name === 'nombreEmpresa' && value !== '') {
            if(!textoEmpresa(value)) {
                return; // No actualizar el estado si contiene caracteres no permitidos
            }
        }
        
        setDatos({
            ...datos,
            [name]: value
        });
    }

    return ( 
    <div id='crear-certificado'>
        <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px" id='logo-empresa'></img>
        <form
        onSubmit={onSubmit}
            id='form-certificado'>
                {<NavMenu actualPage={actualPage}/>}
                    <div id='contenedor-titulo'>
                        <h3><strong>Carnets Grupal</strong></h3>
                    </div>
                <div id='form'>
                    <div id='contenedor-form'>
                        <label>
                            Nombre Empresa:
                        </label>
                        <input 
                            id='input-form' 
                            name='nombreEmpresa'
                            onChange={onChange}
                            value={datos.nombreEmpresa}
                            type='text'
                            autoComplete='off'
                        />
                    </div>
            {/* <div id='contenedor-form'>
                <label>
                    Fecha Expedición:
                </label>
                <input 
                    id='input-form' 
                    name='fecha'
                    value={datos.fecha}
                    onChange={onChange}
                    type='date' 
                    autoComplete='off'
                />
            </div> */}
            </div>
            <button id='boton-form' type='submit'>Certificar</button>
        </form>
    </div> 
     );
}
 
export default Carnets;