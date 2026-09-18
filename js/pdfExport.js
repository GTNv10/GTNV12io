// PDF Generation and Markdown formatting module for GTN v12
import { getFormattedDateForFilename, showToast } from './utils.js';

export function createPdfManager(getState, showPromptModal) {
    let pendingPDFGeneration = null;

    function getPending() {
        return pendingPDFGeneration;
    }

    function setPending(val) {
        pendingPDFGeneration = val;
    }

    function generatePdfFilename() {
        if (!pendingPDFGeneration) return 'Documento';
        const { appData } = getState();
        const { rowData, template } = pendingPDFGeneration;
        
        // Use custom format, or infer best identifier from appData
        const identifierCol = appData.selectedRowIdentifierColumn || (appData.headers && appData.headers[1]) || 'EXPEDIENTE';
        const defaultFormat = appData.headers && appData.headers.includes('EXPEDIENTE')
            ? 'Documento {{EXPEDIENTE}} {{FECHA_ACTUAL}}'
            : (appData.headers && appData.headers.includes('NOMBRE EMPRESA')
                ? 'Documento {{NOMBRE EMPRESA}} {{FECHA_ACTUAL}}'
                : `Documento {{${identifierCol}}} {{FECHA_ACTUAL}}`);
                
        let formatPattern = appData.pdfFilenameFormat || defaultFormat;
        // Clean any underscores from pattern
        formatPattern = formatPattern.replace(/_/g, ' ');

        const manualValues = {};

        const formElement = document.getElementById('manual-vars-form');
        if (formElement && formElement.elements.length > 0) {
            const formData = new FormData(formElement);
            for (let [key, value] of formData.entries()) {
                manualValues[key] = value;
            }
        }
       
        let filename = formatPattern.replace(/\{\{(.*?)\}\}/g, (_, key) => {
            key = key.trim();
            if (manualValues.hasOwnProperty(key)) return String(manualValues[key] || '').trim();
            if (rowData.hasOwnProperty(key)) {
                const value = String(rowData[key] ?? '').trim();
                return value;
            }
            if (key.toLowerCase() === 'fecha_actual' || key.toLowerCase() === 'fecha actual') return getFormattedDateForFilename().replace(/_/g, '-');
            if (key.toLowerCase() === 'nombre_plantilla' || key.toLowerCase() === 'plantilla') return String(template.name || '').trim();
            return '';
        });

        // Sanitize invalid characters and replace underscores with spaces
        filename = filename.replace(/[\\/:*?"<>|]/g, '-').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        
        // If empty or purely "Documento", append template name or row identifier
        if (!filename || filename.toLowerCase() === 'documento') {
            const rowId = (rowData && rowData[identifierCol]) ? String(rowData[identifierCol]).trim() : '';
            const tplName = template && template.name ? template.name.trim() : '';
            const parts = ['Documento', tplName, rowId, getFormattedDateForFilename().replace(/_/g, '-')].filter(Boolean);
            filename = parts.join(' ').replace(/[\\/:*?"<>|]/g, '-').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Ensure no .pdf at the end
        filename = filename.replace(/\.pdf$/i, '').trim();

        return filename || 'Documento';
    }

    async function downloadPDF() {
        if (!pendingPDFGeneration) return;
        const { jsPDF } = window.jspdf;
        const { template, uploadedImages } = pendingPDFGeneration;

        const initialFilename = generatePdfFilename();
        const finalFilename = await showPromptModal('Confirmar nombre del archivo PDF', null, initialFilename);

        if (!finalFilename) return;

        let cleanFilename = String(finalFilename).replace(/_/g, ' ').replace(/\.pdf$/i, '').trim();
        if (!cleanFilename) cleanFilename = 'Documento';

        try {
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const margin = 20;
            const usableWidth = doc.internal.pageSize.getWidth() - (2 * margin);
            const pageHeight = doc.internal.pageSize.getHeight();
            const fontSize = 12;
            const lineHeight = (fontSize * 1.3) * 0.352778;
            let cursorY = margin;

            const addPageIfNeeded = (requiredHeight) => {
                if (cursorY + requiredHeight > pageHeight - margin) {
                    doc.addPage();
                    cursorY = margin;
                    return true;
                }
                return false;
            };

            const parseStyledText = (text) => {
                const parts = [];
                const boldSegments = text.split('**');
                boldSegments.forEach((segment, boldIndex) => {
                    const isBold = boldIndex % 2 !== 0;
                    const italicSegments = segment.split('*');
                    italicSegments.forEach((subSegment, italicIndex) => {
                        const isItalic = italicIndex % 2 !== 0;
                        if (subSegment.length > 0) {
                            parts.push({ text: subSegment, bold: isBold, italic: isItalic });
                        }
                    });
                });
                return parts;
            };

            const getFontStyle = (bold, italic) => {
                if (bold && italic) return 'bolditalic';
                if (bold) return 'bold';
                if (italic) return 'italic';
                return 'normal';
            };

            const writeLineWithMarkdown = (line, x) => {
                let currentX = x;
                const segments = parseStyledText(line);

                for (const segment of segments) {
                    const styleName = getFontStyle(segment.bold, segment.italic);
                    doc.setFont(template.fontFamily || 'Helvetica', styleName);
                    const tokens = segment.text.split(/(\s+)/);

                    for (const token of tokens) {
                        if (token.length === 0) continue;
                        const tokenWidth = doc.getStringUnitWidth(token) * fontSize / doc.internal.scaleFactor;
                        if (currentX + tokenWidth > x + usableWidth) {
                            cursorY += lineHeight;
                            addPageIfNeeded(lineHeight);
                            currentX = x;
                        }
                        doc.text(token, currentX, cursorY);
                        currentX += tokenWidth;
                    }
                }
                doc.setFont(template.fontFamily || 'Helvetica', 'normal');
            };

            doc.setFont(template.fontFamily || 'Helvetica', 'normal');
            doc.setFontSize(fontSize);

            const contentWithPlaceholders = pendingPDFGeneration.template.content;
            const finalRenderableContent = contentWithPlaceholders.replace(/\{\{(?!IMAGEN:)(.*?)\}\}/g, (_, key) => {
                const manualValues = {};
                const manualVarsForm = document.getElementById('manual-vars-form');
                if (manualVarsForm && manualVarsForm.elements.length > 0) {
                    const formData = new FormData(manualVarsForm);
                    for (let [k, value] of formData.entries()) manualValues[k] = value;
                }
                key = key.trim();
                if (manualValues.hasOwnProperty(key)) return manualValues[key];
                if (pendingPDFGeneration.rowData.hasOwnProperty(key)) {
                    const value = String(pendingPDFGeneration.rowData[key] ?? '');
                    return value.trim() ? value : '';
                }
                return '';
            });

            const parts = finalRenderableContent.split(/(\{\{IMAGEN:.*?\}\})/g);

            for (const part of parts) {
                if (part.startsWith('{{IMAGEN:')) {
                    const imageName = part.slice(9, -2).trim();
                    const base64Image = uploadedImages[imageName];
                    if (base64Image) {
                        const imgProps = doc.getImageProperties(base64Image);
                        const aspectRatio = imgProps.width / imgProps.height;
                        let imgWidth = usableWidth;
                        let imgHeight = imgWidth / aspectRatio;

                        const maxImgHeight = pageHeight / 2;
                        if (imgHeight > maxImgHeight) {
                            imgHeight = maxImgHeight;
                            imgWidth = imgHeight * aspectRatio;
                        }

                        addPageIfNeeded(imgHeight + lineHeight);
                        doc.addImage(base64Image, 'JPEG', margin, cursorY, imgWidth, imgHeight);
                        cursorY += imgHeight + lineHeight;
                    }
                } else {
                    const paragraphs = part.split('\n');
                    paragraphs.forEach((paragraph, pIndex) => {
                        if (paragraph.trim() === '') {
                            if (pIndex < paragraphs.length - 1) {
                                cursorY += lineHeight;
                                addPageIfNeeded(lineHeight);
                            }
                            return;
                        }
                        addPageIfNeeded(lineHeight);
                        writeLineWithMarkdown(paragraph, margin);
                        cursorY += lineHeight;
                    });
                }
            }

            doc.save(`${cleanFilename}.pdf`);
            showToast('PDF generado correctamente.', 'success');
        } catch (e) {
            console.error('Error al generar PDF:', e);
            showToast('Hubo un error inesperado al generar el PDF.', 'error');
        } finally {
            document.getElementById('preview-modal')?.classList.remove('active');
            pendingPDFGeneration = null;
        }
    }

    return {
        getPending,
        setPending,
        downloadPDF,
        generatePdfFilename
    };
}
