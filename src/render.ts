import { createCanvas, registerFont } from 'canvas';
import { ShowFlag, Direction } from './molecule';
import path from 'node:path';
import type { Canvas, CanvasRenderingContext2D, ImageData } from 'canvas';
import type { Molecule } from './molecule';

interface MeasureResult {
    top: number;
    bottom: number;
    ascent: number;
    descent: number;
    lineHeight: number;
}

registerFont(path.resolve('./assets/RomanSerif.ttf'), {family: 'RomanSerif'});
const fontMetrics = measure('RomanSerif', 48);
const chgFontMetrics  = measure('RomanSerif', 24);

const SCALE = 200;

function measure (font: string, size = 16) {
    const measureCanvas = createCanvas(size * 1.5, size * 1.5);
    const ctx = measureCanvas.getContext('2d');
    ctx.font = `${size}px "${font}"`;
    const chars = {
        upper: 'H',
        lower: 'x',
        descent: 'p',
        ascent: 'h',
        tittle: 'i',
        overshoot: 'O'
    };

    const l = size * 1.5;
    const result: Partial<MeasureResult> = {
        top: 0
    };
    // Measure line-height
    ctx.clearRect(0, 0, l, l);
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'black';
    ctx.fillText('H', 0, 0);
    const topPx = firstTop(ctx.getImageData(0, 0, l, l));
    ctx.clearRect(0, 0, l, l);
    ctx.textBaseline = 'bottom';
    ctx.fillText('H', 0, l);
    const bottomPx = firstTop(ctx.getImageData(0, 0, l, l));
    result.lineHeight = result.bottom = l - bottomPx + topPx;

    // Measure ascent
    ctx.clearRect(0, 0, l, l);
    ctx.textBaseline = 'top';
    ctx.fillText(chars.ascent, 0, 0);
    result.ascent = firstTop(ctx.getImageData(0, 0, l, l));

    // Measure descent
    ctx.clearRect(0, 0, l, l);
    ctx.textBaseline = 'top';
    ctx.fillText(chars.descent, 0, 0);
    result.descent = firstBottom(ctx.getImageData(0, 0, l, l));
    
    return result as MeasureResult;
}

function firstTop (iData: ImageData) {
    const l = iData.height;
    const data = iData.data;
    for (let i = 3; i < data.length; i+=4) {
        if (data[i] !== 0) {
            return Math.floor((i - 3) *.25 / l);
        }
    }
    return 0;
}

function firstBottom (iData: ImageData) {
    const l = iData.height;
    const data = iData.data;
    for (let i = data.length - 1; i > 0; i -= 4) {
        if (data[i] !== 0) {
            return Math.floor((i - 3) *.25 / l);
        }
    }
    return 0;
}

class MoleculeRenderer {
    molecule: Molecule;
    canvas: Canvas;
    ctx: CanvasRenderingContext2D;
    scaleFactor = 1;
    fontSize = 48;
    labelTop: number[] = [];
    labelLeft: number[] = [];
    labelRight: number[] = [];
    labelBottom: number[] = [];
    constructor (molecule: Molecule) {
        this.molecule = molecule;
        this.canvas = createCanvas(molecule.rangeX * SCALE, molecule.rangeY * SCALE);
        this.ctx = this.canvas.getContext('2d');
        this.ctx.font = '48px "RomanSerif"';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.molecule.rangeX * SCALE, this.molecule.rangeY * SCALE);
        this.ctx.strokeStyle = this.ctx.fillStyle = '#000000';
        this.ctx.lineWidth = 16 / 12;
        this.ctx.textAlign = 'center';
    }

    render () {
        this.ctx.beginPath();
        const mx = this.molecule.minX;
        const my = this.molecule.minY;
        const distance = (fontMetrics.bottom - fontMetrics.top) / 2 - fontMetrics.bottom;
        for (let i = 0; i < this.molecule.atoms.length - 1; i++) {
            const atom = this.molecule.atoms[i];
            this.setFontSize(this.fontSize);
            // Ignore carbon element rendering
            if (atom.element === 'C' && atom.charge === 0 && atom.unpaired === 0 && (atom.showFlag & ShowFlag.EXPLICIT) === 0) {
                this.labelLeft[i] = this.labelRight[i] = this.labelTop[i] = this.labelBottom[i] = 0;
            } else {
                this.labelLeft[i] = this.labelRight[i] = this.ctx.measureText(atom.element).width / 2;
                this.labelTop[i] = (-fontMetrics.ascent) / 2;
                this.labelBottom[i] = (fontMetrics.descent / 2 - fontMetrics.ascent) / 2;
                this.ctx.fillText(atom.element, SCALE * (atom.x - mx), SCALE * (atom.y - my) + distance);
                if (atom.charge !== 0) {
                    const c = atom.charge;
                    let text: string = '';
                    if (c > 0) {
                        if (c === 1) {
                            text = '+';
                        } else {
                            text = c + '+';
                        }
                    } else if (c === -1) {
                        text = '-';
                    } else {
                        text = -c + '-';
                    }
                    this.setFontSize(this.fontSize / 2);
                    const chgwidth = this.ctx.measureText(text).width;
                    const chgdis = (chgFontMetrics.bottom - chgFontMetrics.top) / 2
                            - chgFontMetrics.bottom;
                    this.ctx.fillText(text,
                        SCALE * (atom.x - mx) + this.labelRight[i] + chgwidth / 2,
                        SCALE * (atom.y - my) + fontMetrics.top / 3 + chgdis);
                }
                if (atom.hydrogenCount > 0) {
                    const hCount = atom.hydrogenCount;
                    let hNumWidth = 0;
                    if (hCount > 1) {
                        this.setFontSize(this.fontSize / 2);
                        hNumWidth = this.ctx.measureText('' + hCount).width;
                    }
                    this.setFontSize(this.fontSize);
                    const hWidth = this.ctx.measureText('H').width;
                    let hcx = 0, hcy = 0;
                    if (atom.spareSpace === Direction.BOTTOM) {
                        hcx = SCALE * (atom.x - mx);
                        hcy = SCALE * (atom.y - my) - fontMetrics.ascent;
                        this.labelBottom[i] += -fontMetrics.ascent;
                    } else if (atom.spareSpace === Direction.LEFT) {
                        hcx = SCALE * (atom.x - mx) - this.labelLeft[i] - hWidth / 2
                                - hNumWidth;
                        this.labelLeft[i] += hWidth + hNumWidth / 2 * 2;
                        hcy = SCALE * (atom.y - my);
                    } else if (atom.spareSpace === Direction.TOP) {
                        hcx = SCALE * (atom.x - mx);
                        hcy = SCALE * (atom.y - my) + fontMetrics.ascent;
                        this.labelTop[i] += -fontMetrics.ascent;
                    } else { //DIRECTION_RIGHT
                        hcx = SCALE * (atom.x - mx) + this.labelRight[i] + hWidth / 2;
                        this.labelRight[i] += hWidth + hNumWidth / 2 * 2;
                        hcy = SCALE * (atom.y - my);
                    }
                    this.ctx.fillText('H', hcx, hcy + distance);
                    if (hCount > 1) {
                        this.setFontSize(this.fontSize / 2);
                        this.ctx.fillText('' + hCount, hcx + hWidth / 2 + hNumWidth / 2,
                            hcy - fontMetrics.top / 2);
                    }
                }
            }
            for (let i = 0; i < this.molecule.bonds.length; i++) {
                const bond = this.molecule.bonds[i];
                const p1 = this.molecule.getAtom(bond.from);
                const p2 = this.molecule.getAtom(bond.to);
                this.drawBond(SCALE * (p1.x - mx), SCALE * (p1.y - my),
                    SCALE * (p2.x - mx),
                    SCALE * (p2.y - my), bond.type, bond.from - 1, bond.to - 1);
            }
        }
        this.ctx.closePath();
        return this.canvas.toBuffer();
    }

    calcLinePointConfined (x: number, y: number, x2: number, y2: number,
        left: number, right: number, top: number, bottom: number, out: number[]) {
        const w = x2 > x ? right : left;
        const h = y2 < y ? top : bottom;
        const k = Math.atan2(h, w);
        const sigx = Math.sign(x2 - x);
        const sigy = Math.sign(y2 - y);
        const absRad = Math.atan2(Math.abs(y2 - y), Math.abs(x2 - x));

        if (absRad > k) {
            out[0] = x + sigx * h / Math.tan(absRad);
            out[1] = y + sigy * h;
        } else {
            out[0] = x + sigx * w;
            out[1] = y + sigy * w * Math.tan(absRad);
        }
    }

    drawBond (x1: number, y1: number, x2: number, y2: number, type: number, idx1: number, idx2: number) {
        const ret: number[] = [0, 0];
        const rad = Math.atan2(y2 - y1, x2 - x1);

        // Calculate line points with confinement
        this.calcLinePointConfined(x1, y1, x2, y2, this.labelLeft[idx1], this.labelRight[idx1], this.labelTop[idx1],
            this.labelBottom[idx1], ret);
        const [basex1, basey1] = ret;

        this.calcLinePointConfined(x2, y2, x1, y1, this.labelLeft[idx2], this.labelRight[idx2], this.labelTop[idx2],
            this.labelBottom[idx2], ret);
        const delta = this.fontSize / 6;
        const [basex2, basey2] = ret;

        const dx = Math.sin(rad) * delta;
        const dy = Math.cos(rad) * delta;

        switch (type) {
            case 1:
                this.ctx.moveTo(basex1, basey1);
                this.ctx.lineTo(basex2, basey2);
                this.ctx.stroke();
                break;
            case 2:
                this.ctx.moveTo(basex1 + dx / 2, basey1 - dy / 2);
                this.ctx.lineTo(basex2 + dx / 2, basey2 - dy / 2);
                this.ctx.moveTo(basex1 - dx / 2, basey1 + dy / 2);
                this.ctx.lineTo(basex2 - dx / 2, basey2 + dy / 2);
                this.ctx.stroke();
                break;
            case 3:
                this.ctx.moveTo(basex1, basey1);
                this.ctx.lineTo(basex2, basey2);
                this.ctx.moveTo(basex1 + dx, basey1 - dy);
                this.ctx.lineTo(basex2 + dx, basey2 - dy);
                this.ctx.moveTo(basex1 - dx, basey1 + dy);
                this.ctx.lineTo(basex2 - dx, basey2 + dy);
                break;
        }
    }

    setFontSize (size: number) {
        const match = /(?<value>\d+\.?\d*)/;
        this.ctx.lineWidth = size / 12;
        this.ctx.font = this.ctx.font.replace(match, String(size));
    }
}

export { MoleculeRenderer };
