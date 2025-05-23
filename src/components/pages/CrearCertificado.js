import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { Link } from 'react-router-dom'

import { llenarDocx } from '../util/DocxToPdf'
import UserGroup from '../../assets/usergroup.svg'
import Module from '../../assets/module.svg'
import Signature from '../../assets/signature.svg'
import NavMenu from '../util/NavMenu'

const CrearCertificado = () => {

    const actualPage = 'CertificarAlimentos'
    
    // Inicializar el servidor cuando el componente se monta
    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.startServer();
            
            const serverStatusHandler = (message) => {
                if (message.type === 'error') {
                    console.error('Server error:', message.message);
                    // Aquí podrías agregar lógica para reintentar o notificar al usuario
                } else {
                    console.log('Server status:', message.message);
                }
            };
            
            window.electronAPI.onServerStatus(serverStatusHandler);
            
            // Add cleanup
            return () => {
                window.electronAPI.startServer('stop'); // Signal server to stop
            };
        }
    }, []); // Se ejecuta solo una vez al montar el componente

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
            if(datos.nombres.length < 2){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'Los nombres deben tener más de 2 caracteres',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })    
                return;
            }
            else if(!soloTexto(datos.nombres)){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'El campo nombres solo permite letras y espacios',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })
                return;
            }
            else if(datos.apellidos.length < 2){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'Un apellido debe tener al menos 2 caracteres',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })
                return;
            }
            else if(!soloTexto(datos.apellidos)){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'El campo apellidos solo permite letras y espacios',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })
                return;
            }
            else if(datos.cc.length < 4){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'El documento debe ser mayor a 4 digitos',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })
                return;
            }else {
                llenarDocx(datos, "Alimentos")
                
            }
            
        } catch (error) {
            Swal.fire({
                icon:'error',
                title:'Ooops',
                text: 'Algo ha sucedido...',
                didOpen: () => {
                    Swal.hideLoading()
                  } 
            })
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
        <div 
            id='crear-certificado'>        
                    <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px" id='logo-empresa'></img>
            <form
                onSubmit={onSubmit}
                autoComplete='off'
                id='form-certificado'>
                    
                    {<NavMenu actualPage={actualPage}/>}
                    <div id='contenedor-titulo'>
                        <h3><strong>Certificado Individual</strong></h3>
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
 
export default CrearCertificado;