import React, { useState } from 'react'
import { llenarDocx } from '../util/DocxToPdf'
import Swal from 'sweetalert2'
import { Link } from 'react-router-dom'
import UserGroup from '../../assets/usergroup.svg'

const CrearCertificado = () => {
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
            if(datos.nombres.length < 2 ){
                Swal.fire({
                    icon:'error',
                    title:'Oops...',
                    text: 'Los nombres deben tener más de 2 caracteres',
                    didOpen: () => {
                        Swal.hideLoading()
                      }
                })    
    
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
    
            }else {
                llenarDocx(datos)
                
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
        setDatos({
            ...datos,
            [e.target.name]: e.target.value
        })        
    }
   

    return (
        <div 
            id='crear-certificado'>        
                    <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px"></img>
            <form
                onSubmit={onSubmit}
                id='form-certificado'>
                    {/* <h2>Crear Certificado</h2> */}
                    <Link to='/carguemasivo'>
                        <img id='logo-principal' src={UserGroup} />                
                    </Link>
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
                        />
                    </div>
                    
                    <button id='boton-form' type='submit'>Crear</button>                    
            </form>
        </div>  
    );
}
 
export default CrearCertificado;