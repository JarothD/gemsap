import Swal from 'sweetalert2';

export const SwalAlert = {
    loading: (title = 'Generando Certificado', message = 'Cargando...') => {
        return Swal.fire({
            title,
            html: message,
            allowEscapeKey: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading()
            }
        });
    },

    success: (title = 'Éxito', message = 'Operación completada') => {
        return Swal.fire({
            icon: 'success',
            title,
            text: message
        });
    },

    error: (title = 'Oops...', message = 'Algo ha sucedido...') => {
        return Swal.fire({
            icon: 'error',
            title,
            text: message,
            didOpen: () => {
                Swal.hideLoading()
            }
        });
    },

    progress: (title = 'Generando Certificados', messageData) => {
        return Swal.fire({
            title,
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
    },

    validations: {
        nombreEmpresa: () => {
            return Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Nombre de Empresa debe tener más de 2 caracteres',
                didOpen: () => {
                    Swal.hideLoading()
                }
            });
        },

        nombres: () => {
            return Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Los nombres deben tener más de 2 caracteres',
                didOpen: () => {
                    Swal.hideLoading()
                }
            });
        },

        apellidos: () => {
            return Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Un apellido debe tener al menos 2 caracteres',
                didOpen: () => {
                    Swal.hideLoading()
                }
            });
        },

        cedula: () => {
            return Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'El documento debe ser mayor a 4 digitos',
                didOpen: () => {
                    Swal.hideLoading()
                }
            });
        },

        archivos: () => {
            return Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Verifique la existencia de Cargue_Masivo.xlsx y PlantillaSimple.docx',
                didOpen: () => {
                    Swal.hideLoading()
                }
            });
        }
    }
};

export default SwalAlert;