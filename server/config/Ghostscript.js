const { exec } = require("child_process");
const path = require("path");
const fs = require('fs');

const libre = require('libreoffice-convert'); // Asegúrate de que libreoffice-convert esté instalado
const { PDFDocument } = require('pdf-lib'); // Asegúrate de instalar pdf-lib

// Detectar el sistema operativo y configurar el comando de Ghostscript
const isWindows = process.platform === 'win32';
const GS_CMD = isWindows 
    ? (process.arch.includes("64") ? "gswin64c" : "gswin32c") // Comando para Windows
    : "gs"; // Comando para Linux

/**
 * Verifica si Ghostscript está instalado y funcionando
 * @returns {Promise<void>}
 */
function checkGhostscript() {
    return new Promise((resolve, reject) => {
        exec(`${GS_CMD} --version`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error al ejecutar Ghostscript: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`Error en Ghostscript: ${stderr}`);
                return;
            }
            console.log("Ghostscript está funcionando. Versión:", stdout.trim());
            resolve();
        });
    });
}

/**
 * Convierte un PDF a imágenes PNG usando Ghostscript
 * @param {string} inputPDF - Ruta del archivo PDF de entrada
 * @param {string} outputDir - Carpeta donde se guardarán las imágenes
 * @param {number} dpi - Resolución de salida (por defecto 300)
 * @returns {Promise<string[]>} - Lista de archivos generados
 */
function convertPDFToPNG(inputPDF, outputDir, dpi = 300) {
    return new Promise((resolve, reject) => {
        const outputPattern = path.join(outputDir, "output-%03d.png");
        const gsCommand = `${GS_CMD} -dNOPAUSE -sDEVICE=png16m -r${dpi} -o "${outputPattern}" "${inputPDF}"`;

        exec(gsCommand, (error, stdout, stderr) => {
            if (error) return reject(`Error al ejecutar Ghostscript: ${error.message}`);
            if (stderr) console.warn(`Advertencias en Ghostscript: ${stderr}`);

            // Buscar los archivos generados
            fs.readdir(outputDir, (err, files) => {
                if (err) return reject(`Error al leer el directorio: ${err.message}`);

                // Filtrar los archivos generados por Ghostscript (imágenes PNG)
                const imageFiles = files
                    .filter(file => file.startsWith("output-") && file.endsWith(".png"))
                    .map(file => path.join(outputDir, file))
                    .sort(); // Ordenar en caso de múltiples imágenes

                if (imageFiles.length === 0) return reject("No se generaron imágenes");

                resolve(imageFiles);
            });
        });
    });
}

async function convertImagesToPDF(imagePaths, outputPdfPath) {
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
        return Promise.reject(new Error("imagePaths debe ser un array con al menos una imagen."));
    }

    try {
        // Crear un nuevo documento PDF
        const pdfDoc = await PDFDocument.create();

        for (const imagePath of imagePaths) {
            const inputBuffer = fs.readFileSync(imagePath);
            const pdfBuffer = await new Promise((resolve, reject) => {
                libre.convert(inputBuffer, '.pdf', undefined, (err, done) => {
                    if (err) return reject(err);
                    resolve(done);
                });
            });

            // Cargar el PDF generado y agregarlo al documento principal
            const tempPdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await pdfDoc.copyPages(tempPdf, tempPdf.getPageIndices());
            copiedPages.forEach((page) => pdfDoc.addPage(page));
        }

        // Guardar el PDF combinado en un archivo temporal
        const tempOutputPath = `${outputPdfPath}.tmp`;
        const combinedPdfBuffer = await pdfDoc.save();
        fs.writeFileSync(tempOutputPath, combinedPdfBuffer);

        // Renombrar el archivo temporal al archivo final
        if (fs.existsSync(outputPdfPath)) {
            fs.unlinkSync(outputPdfPath); // Eliminar el archivo existente si ya está presente
        }
        fs.renameSync(tempOutputPath, outputPdfPath);

        //console.log("PDF generado correctamente:", outputPdfPath);
        return outputPdfPath;
    } catch (error) {
        console.error("Error al convertir imágenes a PDF:", error);
        throw error;
    }
}

// Exportamos la función para usarla en otros archivos
module.exports = { checkGhostscript, convertPDFToPNG, convertImagesToPDF };