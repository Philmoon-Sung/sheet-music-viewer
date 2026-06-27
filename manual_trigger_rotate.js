const { PDFDocument, degrees } = require('pdf-lib');
const fs = require('fs');

async function rotate() {
    try {
        const filePath = 'e:\\가요 악보모음\\하\\환희-정수라.pdf';

        console.log(`Loading ${filePath}...`);
        if (!fs.existsSync(filePath)) {
            console.log("File not found!");
            return;
        }

        const fileBuffer = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(fileBuffer);
        const page = pdfDoc.getPages()[0];

        // CORRECTION: The file requires 180 rotation to be upright.
        page.setRotation(degrees(180));

        const newRotation = page.getRotation().angle;
        console.log(`Corrected Rotation: ${newRotation}`);

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, pdfBytes);
        console.log('Saved 180 degrees (Correct)!');

    } catch (err) {
        console.error(err);
    }
}

rotate();
