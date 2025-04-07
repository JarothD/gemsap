import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2'

import { cargueMasivoBebidas } from '../util/DocxToPdf';
import wss from '../../config/wss'
import NavMenu from '../util/NavMenu';

const CargueMasivoBebidas = () => {
    const actualPage = 'BebidasMasivo'
    const [cargando, setCargando] = useState('Cargando...')

    // Usar useEffect para manejar la suscripción al WebSocket
    useEffect(() => {
        const handleMessage = (data) => {
            try {
                // Intentar parsear el mensaje como JSON
                const messageData = JSON.parse(data);
                if (messageData.type === 'progress') {
                    setCargando(messageData.message);
                    Swal.fire({
                        title: 'Generando Certificados',
                        html: `
                            <div class="progress-info">
                                <p>${messageData.message}</p>
                                ${messageData.counter ? 
                                    `<p class="counter">${messageData.counter}</p>` 
                                    : ''}
                            </div>
                        `,
                        allowEscapeKey: false,
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading()
                        }
                    });
                }
            } catch (e) {
                // Si no es JSON, manejar como antes
                if(data === 'Ready') {
                    setCargando('Proceso completado');
                    Swal.close();
                } else if(data === 'Error') {
                    Swal.fire({
                        icon:'error',
                        title:'Oops...',
                        text: 'Verifique la existencia de Cargue_Masivo_Bebidas.xlsx y PlantillaSimpleBebidas.docx',
                        didOpen: () => {
                            Swal.hideLoading()
                        }
                    });
                    wss.send('Ready');
                }
            }
        };

        wss.addMessageHandler(handleMessage);
        return () => wss.removeMessageHandler(handleMessage);
    }, []);

    // ... resto del código existente (fechaActual, datos, onSubmit, onChange) ...
    let fechaActual = new Date()
    let anio = fechaActual.getFullYear(),
        mes = fechaActual.getMonth() + 1,
        dia = fechaActual.getDate()
    if(dia < 10){
        dia = '0'+ dia;
    }
    if(mes <10){
        mes = '0' + mes;
    }
    let format = anio + "-" + mes + "-" + dia    

    const [datos, setDatos] = useState({
        nombreEmpresa: '',
        fecha: format
    })

    const onSubmit = async e => {
        e.preventDefault();
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
            cargueMasivoBebidas(datos)
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
        setDatos({
            ...datos,
            [e.target.name]: e.target.value
        })        
    }

    // El return se mantiene igual
    return ( 
        <div id='crear-certificado'>
            <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px"></img>
            <form
                onSubmit={onSubmit}
                id='form-certificado'>
                    <NavMenu actualPage={actualPage}/>
                    <div id='contenedor-titulo'>
                    <h3><strong>Bebidas Grupal</strong></h3>
                </div>
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
                <button id='boton-form' type='submit'>Certificar</button>
            </form>
        </div>  
    );
}

export default CargueMasivoBebidas;