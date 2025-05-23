import React, { useState } from 'react'

import SwalAlert from '../util/Swal';
import NavMenu from '../util/NavMenu';
import { llenarDocx } from '../util/DocxToPdf';

const CrearCertificadoBebidas = () => {
    const actualPage = 'bebidas'

    // Función para validar que un campo solo contiene texto y espacios
    const soloTexto = (texto) => {
        return /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(texto);
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
        nombres: '',
        apellidos:'',
        cc:'',
        fecha: format
    })

    const onSubmit = async e => {
        e.preventDefault();        
        SwalAlert.loading();
        try {
            if(datos.nombres.length < 2){
                await SwalAlert.validations.nombres();
                return;
            }
            if(!soloTexto(datos.nombres)){
                await SwalAlert.validations.soloTexto();
                return;
            }
            if(datos.apellidos.length < 2){
                await SwalAlert.validations.apellidos();
                return;
            }
            if(!soloTexto(datos.apellidos)){
                await SwalAlert.validations.soloTexto();
                return;
            }
            if(datos.cc.length < 4){
                await SwalAlert.validations.cedula();
                return;
            } else {
                await llenarDocx(datos, "Bebidas")
            }
            
        } catch (error) {
            await SwalAlert.error();
        }
    }

    const onChange = e => {
        const { name, value } = e.target;
        
        // Si es un campo de texto (nombres o apellidos) y no está vacío, validar que solo contenga letras
        if ((name === 'nombres' || name === 'apellidos') && value !== '') {
            if(!soloTexto(value)) {
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
            autoComplete='off'
            id='form-certificado'>
                {<NavMenu actualPage={actualPage}/>}
                <div id='contenedor-titulo'>
                    <h3><strong>Bebidas Individual</strong></h3>
                </div>
                <div id='form'>
                    <div id='contenedor-form'>
                            <label>
                                Nombres:
                            </label>
                            <input 
                                id='input-form' 
                                name='nombres'
                                onChange={onChange}
                                value={datos.nombres}
                                type='text'
                                autoComplete='off'
                                
                            />
                        </div>
                        <div id='contenedor-form'>
                            <label>
                                Apellidos:
                            </label>
                            <input 
                                id='input-form' 
                                name='apellidos'
                                onChange={onChange}
                                value={datos.apellidos}
                                type='text' 
                                autoComplete='off'
                            />
                        </div>
                        <div id='contenedor-form'>
                            <label>
                                Cédula de Ciudadanía:
                            </label>
                            <input 
                                id='input-form' 
                                name='cc'
                                onChange={onChange}
                                value={datos.cc}
                                type='number'   
                                autoComplete='off'                     
                            />
                        </div>
                        <div id='contenedor-form'>
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
                        </div>
                    </div>
                        <button id='boton-form' type='submit'>Certificar</button>                    
        </form>
    </div> 
    );
}
 
export default CrearCertificadoBebidas;