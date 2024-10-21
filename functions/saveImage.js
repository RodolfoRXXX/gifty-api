const fs = require("fs").promises; // Usar la versión de promesas de fs
const Jimp = require("jimp");

// imagen, id, tabla, type, image, width, height, prev_thumb
async function save_image(profileId, type, image, width, height, prev_thumb) {
    try {
        // Extraer la extensión de la imagen
        const [metaData, base64Image] = image.split(';base64,');
        const extension = metaData.split('/')[1];

        // Generar el nombre y ruta de la nueva imagen
        const name_image = `${profileId}/${type}-${profileId}.${extension}`;
        const folderPath = `./public/uploads/${profileId}`;
        const route = `${folderPath}/${type}-${profileId}.${extension}`;

        // Ruta de la imagen anterior
        const prev_route = `./public/uploads/${prev_thumb}`;

        // Verificar y eliminar la imagen anterior si no es "no-image-user.png"
        if (prev_thumb !== 'no-image-user.png' && await fileExists(prev_route)) {
            await fs.unlink(prev_route);
        }

        // Crear la carpeta si no existe
        await fs.mkdir(folderPath, { recursive: true });

        // Procesar la nueva imagen
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const image_def = await Jimp.read(imageBuffer);
        await image_def.cover(width, height, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
        await image_def.quality(95).writeAsync(route);

        return name_image;
    } catch (error) {
        console.error("Error saving image:", error);
        return error;
    }
}

// Verificar si un archivo existe
async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

module.exports = save_image;

