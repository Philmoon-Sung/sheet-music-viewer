const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function inspect() {
    try {
        // Try to find the file. Title '환희' or '흐르는 음악소리'
        // Let's look for '환희' first.
        let filePath = 'e:\\가요 악보모음\\하\\환희-정수라.pdf';

        if (!fs.existsSync(filePath)) {
            console.log("File not found at: " + filePath);
            // Try searching dir
            const files = fs.readdirSync('e:\\가요 악보모음\\하');
            const found = files.find(f => f.includes('환희'));
            if (found) {
                filePath = 'e:\\가요 악보모음\\하\\' + found;
                console.log("Found file: " + filePath);
            } else {
                console.log("Cannot find file with '환희'");
                return;
            }
        }

        const fileBuffer = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const page = pdfDoc.getPages()[0];
        const rotation = page.getRotation().angle;
        console.log(`Current Rotation: ${rotation}`);
        console.log(`Dimensions: ${page.getWidth()}x${page.getHeight()}`);

    } catch (err) {
        console.error(err);
    }
}

inspect();
