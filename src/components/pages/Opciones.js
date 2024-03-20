import React from 'react';
import { Link } from 'react-router-dom';
import User from '../../assets/user.svg'
import UserGroup from '../../assets/usergroup.svg'
import Module from '../../assets/module.svg'

const Opciones = () => {
    return ( 
        <div id='crear-certificado'>
        <img width="190" height="95" src="https://gemsap.com/wp-content/uploads/2022/08/imageonline-co-whitebackgroundremoved-1-4-190x95.png"  alt="Logo Gemsap" sizes="(max-width: 190px) 100vw, 190px"></img>
        <form id='form-certificado'>
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

        </form>
    </div>
    );
}
 
export default Opciones;