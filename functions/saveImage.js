const fs = require("fs");
const Jimp = require("jimp");
//id, image

// imagen, id, id_autor, tabla
async function save_image(id, table, type, image, width, height, blanck){
    try {
        let base64Image = image.split(';base64,').pop();
        let name_image = id + '-' + table + '-' + type;
        name_image = name_image + '.' + (image.split(';base64,')[0]).split('/')[1]
        let route = './public/uploads/' + name_image;

        //Verifica si la imagen anterior es la no-image.png
        //Si es, no elimina su ubicación
        if(!blanck) {
            //Busca el archivo existente y lo elimina
            if(fs.existsSync(route)) {
                fs.unlink(route, (err) => {
                    if(err) {
                        throw 'error'
                    }
                });
            }
        }
            //Si no es
            let buff = Buffer.from(base64Image, 'base64');     
            const image_def = await Jimp.read(buff);
                                await image_def.cover(width, height, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
                                await image_def.quality(95);
                                await image_def.writeAsync(route);
            return name_image
    } catch (error) {
        return error;
    }
}

module.exports = save_image;