import { clienteAxios } from "../../config/axios";

export async function obtenerPerfiles() {
    const respuesta = await clienteAxios.get('/firmas')
    return respuesta.data;
}

export async function cambiarPerfil(perfil) {
    const respuesta = await clienteAxios.post('/firmas', { perfil })
    return respuesta;
}