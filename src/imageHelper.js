import fs from 'fs/promises';

class ImageHelper {
    async saveImage(buffer, path) {
        try {
            await fs.writeFile(path, buffer);
            console.log('Изображение успешно сохранено как generated_image.png');

            return path;
        } catch (error) {
            console.log('Error while saving image', error);
            throw error;
        }
    }


}

export const imageHelper = new ImageHelper();