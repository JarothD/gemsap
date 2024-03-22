import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import User from '../../assets/user.svg'
import UserGroup from '../../assets/usergroup.svg'
import Module from '../../assets/module.svg'
import { cambiarPerfil, obtenerPerfiles } from '../util/Signature';
import Swal from 'sweetalert2';

const PerfilFirma = () => {

    const [ perfil, setPerfil ] = useState(2)
    const [ perfiles, setPerfiles ] = useState([])

    const getPerfiles = async () => {
        const { firmas, firmaSeleccionada} = await obtenerPerfiles()
        setPerfil(firmaSeleccionada)
        setPerfiles(firmas)
    }

    useEffect(() => {
      getPerfiles()
    }, [])
    
    const onSubmit = async e => {
        e.preventDefault()
        cambiarPerfil(perfil)
        Swal.fire({
            icon:'success',
            title:'Éxito',
            text: 'Perfíl Actualizado'
        })
    }
    

    const onChange = e => {      
        const newValue = parseInt(e.target.value)
        setPerfil(newValue)        
        }
        
    return ( 
        <div id='crear-certificado'>
        <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px"></img>
        <form id='form-certificado' onSubmit={onSubmit}>
            <div id='buttons-container'>
                <Link to='/'>
                    <img id='logo-principal' src={User} />                
                </Link>
                <Link to='/carguemasivo'>
                    <img id='logo-principal' src={UserGroup} />                
                </Link>
                <Link to='/modulos'>
                    <img id='logo-principal' src={Module} />                
                </Link>
            </div>
            <div id='contenedor-form'>
                <h3><strong>Cambiar Perfíl Firma</strong></h3>
            </div>
            <div id='contenedor-form'>
                <label>
                    Perfíl:
                </label>
                <select
                    id='input-form'
                    onChange={onChange}
                    value={perfil}
                    name='perfil'>
                    { perfiles.length > 0 && (perfiles.map(perfil => (<option key={perfil.firma} value={perfil.firma}>{perfil.firma} - {perfil.nombreFirma}</option>)))}
                </select>
            </div>
            <button id='boton-form' type='submit'>Cambiar Perfíl</button>
        </form>
    </div>
    );
}
 
export default PerfilFirma;