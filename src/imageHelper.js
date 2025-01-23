import fsPromises from 'fs/promises';
import axios from "axios";
import fs from "node:fs";

class ImageHelper {
    async saveImageBuffer(buffer, path) {
        try {
            await fsPromises.writeFile(path, buffer);
            console.log('Изображение успешно сохранено как generated_image.png');

            return path;
        } catch (error) {
            console.log('Error while saving image', error);
            throw error;
        }
    }

    async downloadImage(fileUrl, filePath) {
        try {
            const writer = fs.createWriteStream(filePath);

            const response = await axios({
                url: fileUrl,
                method: 'GET',
                responseType: 'stream',
            });

            response.data.pipe(writer);


            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            return filePath;
        } catch (error) {
            console.log('Error while downloading image', error);
            throw error;
        }
    }

}

export const imageHelper = new ImageHelper();