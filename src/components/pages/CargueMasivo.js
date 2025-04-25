import React, { useState, useEffect } from 'react'
import SwalAlert from '../util/Swal';
import { cargueMasivo } from '../util/DocxToPdf';
import wsClient from '../../config/wss'
import NavMenu from '../util/NavMenu';
import useWebSocket from '../../hooks/useWebSocket';

// Helper function for better object logging
const formatLog = (obj) => {
    try {
        if (typeof obj === 'object' && obj !== null) {
            return JSON.stringify(obj);
        }
        return String(obj);
    } catch (e) {
        return `[Non-serializable object: ${e.message}]`;
    }
};

const CargueMasivo = () => {
    const actualPage = 'AlimentosMasivo'
    const [cargando, setCargando] = useState('Cargando...')
    
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
    
    // Use our WebSocket hook
    const { lastMessage, connected } = useWebSocket();

    // Respond to WebSocket messages for UI updates (not Swal - that's handled globally)
    useEffect(() => {
        if (!lastMessage) return;
        
        try {
            console.log('WebSocket message received in CargueMasivo:', 
                typeof lastMessage === 'object' ? formatLog(lastMessage) : lastMessage);
            
            // Handle progress updates for component state
            if (typeof lastMessage === 'string') {
                setCargando(lastMessage);
            } else if (lastMessage.type === 'progress') {
                setCargando(lastMessage.message || 'Procesando...');
            } else if (lastMessage.message) {
                setCargando(lastMessage.message);
            }
            
            // Handle completion
            if (lastMessage === 'Ready' || (lastMessage.type === 'status' && lastMessage.status === 'ready')) {
                setCargando('Proceso completado');
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    }, [lastMessage]);

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

    const onSubmit = async e => {
        e.preventDefault();
        
        // Ensure WebSocket connection is active
        if (!connected) {
            console.log('WebSocket not connected, attempting to reconnect...');
            wsClient.reconnect();
            // Wait for connection to establish
            await new Promise(resolve => {
                setTimeout(resolve, 1000);
            });
        }
        
        // Show loading dialog
        SwalAlert.loading('Generando Certificados', 'Preparando proceso...');
        
        try {
            if(datos.nombreEmpresa.length < 2){
                await SwalAlert.validations.nombreEmpresa();
                return;  
            }
            
            if(!textoEmpresa(datos.nombreEmpresa)){
                await SwalAlert.validations.textoEmpresa();
                return;
            }
            
            const outputDir = await cargueMasivo(datos);
            console.log('Proceso completado:', outputDir);
            
        } catch (error) {
            console.error('Error en proceso de generación:', error);
            await SwalAlert.error('Error', 'Error al generar los certificados');
        }
    }

    return (
        <div id='crear-certificado'>
            <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png" alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px" id='logo-empresa'></img>
            <form 
                autoComplete='off'
                onSubmit={onSubmit} 
                id='form-certificado'>
                <NavMenu actualPage={actualPage}/>
                <div id='contenedor-titulo'>
                    <h3><strong>Certificado Grupal</strong></h3>
                    {!connected && <p style={{color: 'orange'}}>(Servidor desconectado)</p>}
                </div>
                <div id='form'>
                    <div id='contenedor-form'>
                        <label htmlFor="nombreEmpresa">
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
                        <label htmlFor="fecha">
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

export default CargueMasivo;