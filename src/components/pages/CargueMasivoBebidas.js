import React, { useState, useEffect } from 'react'

import SwalAlert from '../util/Swal';
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
                    SwalAlert.progress('Generando Certificados', messageData);
                }
            } catch (e) {
                // Si no es JSON, manejar como antes
                if(data === 'Ready') {
                    setCargando('Proceso completado');
                    Swal.close();
                } else if(data === 'Error') {
                    SwalAlert.validations.archivos();
                    wss.send('Ready');
                }
            }
        };

        wss.addMessageHandler(handleMessage);
        return () => wss.removeMessageHandler(handleMessage);
    }, []);

    // ...existing code...
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
        SwalAlert.loading();
        try {
            if(datos.nombreEmpresa.length < 2){
                await SwalAlert.validations.nombreEmpresa();
                return;
            }
            await cargueMasivoBebidas(datos);
        } catch (error) {
            console.log(error);
            await SwalAlert.error();
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
            <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px" id='logo-empresa'></img>
            <form
                onSubmit={onSubmit}
                id='form-certificado'>
                    {<NavMenu actualPage={actualPage}/>}
                    <div id='contenedor-titulo'>
                        <h3><strong>Bebidas Grupal</strong></h3>
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

export default CargueMasivoBebidas;