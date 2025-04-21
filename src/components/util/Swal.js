import Swal from 'sweetalert2';

export const SwalAlert = {
    loading: (title = 'Generando Certificado', message = 'Cargando...') => {
        return Swal.fire({
            title,
            html: message,
            allowEscapeKey: false,
            allowOutsideClick: false,
            showConfirmButton: false,
            allowEnterKey: false,
            didOpen: () => {
                Swal.showLoading()
            }
        });
    },

    updateLoading: (message) => {
        if (Swal.isVisible()) {
            console.log('Updating Swal with message:', message);
            Swal.update({
                html: message,
                showConfirmButton: false
            });
        }
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
        // Handle both string and object message formats
        let message = '';
        let counter = '';
        
        if (typeof messageData === 'string') {
            message = messageData;
        } else if (messageData && typeof messageData === 'object') {
            message = messageData.message || 'Procesando...';
            counter = messageData.counter || '';
        }
        
        return Swal.fire({
            title,
            html: `
                <div class="progress-info">
                    <p>${message}</p>
                    ${counter ? `<p class="counter">${counter}</p>` : ''}
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

// Initialize WebSocket listener after export to avoid circular dependency
setTimeout(() => {
    // Dynamically import to avoid circular dependency
    import('./utils/wsListeners').then(module => {
        const setupGlobalSwalUpdater = module.default;
        setupGlobalSwalUpdater();
        console.log('WebSocket listener for Swal initialized');
    }).catch(err => {
        console.error('Error initializing WebSocket listener:', err);
    });
}, 1000);

export default SwalAlert;