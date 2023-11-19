enum Direction {
    UNSPECIFIED = 0,
    TOP = 1,
    BOTTOM = 2,
    LEFT = 4,
    RIGHT = 8
}

enum ShowFlag {
    DEFAULT = 0,
    EXPLICIT = 1,
    IMPLICT = 2
}

class Atom {
    charge: number = 0;
    element: string = '';
    showFlag: ShowFlag = ShowFlag.DEFAULT;
    hydrogenCount: number = 0;
    spareSpace: Direction = Direction.UNSPECIFIED;
    isotope: number = 0;
    mapnum: number = 0;
    unpaired: number = 0;
    x: number = 0;
    y: number = 0;
    z: number = 0;
}

class Bond {
    from: number = 0;
    to: number = 0;
    type: number = 0;
    stereoDirection: number = 0;
}

class Molecule {
    atoms: Atom[];
    bonds: Bond[];
    #minX = 0;
    #minY = 0;
    #maxX = 0;
    #maxY = 0;
    xyCalculated = false;
    avgBondLength = 0;
    mdlMolStr: string;
    constructor (a: Atom[], b: Bond[], mdl: string) {
        this.atoms = a;
        this.bonds = b;
        this.mdlMolStr = mdl;
    }

    private determineMinMax () {
        this.xyCalculated = true;
        if (this.atoms.length === 0) {
            this.#maxY = 0;
            this.#minY = 0;
            this.#maxX = 0;
            this.#minX = 0;
            return;
        }

        // Calculate from first atom
        const atomX = this.atomX(1);
        this.#maxX = atomX;
        this.#minX = atomX;
        const atomY = this.atomY(1);
        this.#maxY = atomY;
        this.#minY = atomY;
        for (let n = 1; n <= this.atoms.length; n++) {
            const x = this.atomX(n);
            const y = this.atomY(n);
            this.#minX = Math.min(this.#minX, x);
            this.#maxX = Math.max(this.#maxX, x);
            this.#minY = Math.min(this.#minY, y);
            this.#maxY = Math.max(this.#maxY, y);
        }
    }

    get minX () {
        if (!this.xyCalculated) {
            this.determineMinMax();
        }
        return this.#minX;
    }

    get minY () {
        if (!this.xyCalculated) {
            this.determineMinMax();
        }
        return this.#minY;
    }

    get maxX () {
        if (!this.xyCalculated) {
            this.determineMinMax();
        }
        return this.#maxX;
    }

    get maxY () {
        if (!this.xyCalculated) {
            this.determineMinMax();
        }
        return this.#maxY;
    }

    get rangeX () {
        return this.maxX - this.minX;
    }

    get rangeY () {
        return this.maxY - this.minY;
    }

    getAtom (index: number) {
        if (index > 0 && index <= this.atoms.length) {
            return this.atoms[index - 1];
        }
        throw new Error(`Atoms: get ${index}, totalAtoms=${this.atoms.length}`);
    }

    getBond (index: number) {
        if (index > 0 && index <= this.bonds.length) {
            return this.bonds[index - 1];
        }
        throw new Error(`Bonds: get ${index}, totalBonds=${this.bonds.length}`);
    }

    getAtomIndexNear (x: number, y: number, tolerance: number) {
        if (this.atoms.length === 0) return -1;

        let index = 1;
        let t1 = this.atoms[0].x - x;
        let t2 = this.atoms[0].y - y;
        let t3: number = 0;
        let curr = t1 * t1 + t2 * t2;
        for (let i = 1; i < this.atoms.length; i++) {
            t1 = this.atoms[i].x - x;
            t2 = this.atoms[i].y - y;
            t3 = t1 * t1 + t2 * t2;
            if (t3 < curr) {
                index = i;
                curr = t3;
            }
        }
        if (curr < tolerance * tolerance) {
            return index;
        } 
        return -1;
        
    }

    atomX (index: number) {
        return this.getAtom(index).x;
    }

    atomY (index: number) {
        return this.getAtom(index).y;
    }

    atomZ (index: number) {
        return this.getAtom(index).z;
    }
    
    getAtomDeclaredBonds (atomId: number) {
        if (atomId >= 0 && atomId <= this.atoms.length) {
            const ret: Bond[] = [];
            for (const b of this.bonds) {
                if (b.from === atomId || b.to === atomId) {
                    ret.push(b);
                }
            }
            return ret;
        }

        throw new Error(`getAtomDeclaredBonds: get ${atomId}, bondCount=${this.bonds.length}`);
    }

    getAtomId (atom: Atom) {
        for (const atomId in this.atoms) {
            if (atom === this.atoms[atomId]) {
                return parseInt(atomId);
            }
        }
        return -1;
    }

    getBondId (bond: Bond) {
        for (const bondId in this.bonds) {
            if (bond === this.bonds[bondId]) {
                return parseInt(bondId);
            }
        }
        return -1;
    }
    
    initOnce () {
        for (let i = 0; i < this.atoms.length; i++) {
            const atom = this.atoms[i];
            const bs = this.getAtomDeclaredBonds(i);
            let ii = 0;

            for (const b of bs) {
                ii += b.type;
            }

            if (atom.hydrogenCount === 0) {
                switch (atom.element) {
                    case 'C':
                        atom.hydrogenCount = Math.max(0, 4 - atom.unpaired - Math.abs(atom.charge) - ii);
                        break;
                    case 'O':
                    case 'S':
                        atom.hydrogenCount = Math.max(0, 2 - atom.unpaired + atom.charge - ii);
                        break;
                    case 'N':
                    case 'P':
                        atom.hydrogenCount = Math.max(0, 3 - atom.unpaired + atom.charge - ii);
                        break;
                    case 'F':
                    case 'Cl':
                    case 'Br':
                    case 'I':
                        atom.hydrogenCount = Math.max(0, 1 - atom.unpaired - Math.abs(atom.charge) - ii);
                        break;
                }
            }

            if (atom.element === 'C') {
                if (bs.length === 2) {
                    let t1 = Math.atan2(this.atomY(bs[0].from) - this.atomY(bs[0].to), this.atomX(bs[0].from) - this.atomX(bs[0].to));
                    let t2 = Math.atan2(this.atomY(bs[1].from) - this.atomY(bs[1].to), this.atomX(bs[1].from) - this.atomX(bs[1].to));

                    if (t1 < 0) {
                        t1 += Math.PI;
                    }

                    if (t2 < 0) {
                        t2 += Math.PI;
                    }

                    if (Math.abs(t1 - t2) < (10 / 360) * Math.PI * 2) {
                        atom.showFlag |= ShowFlag.EXPLICIT;
                    }
                }
            }

            let top = 6.28, bottom = 6.28, left = 6.28, right = 6.28;

            for (const b of bs) {
                const x1 = this.atomX(i);
                const y1 = this.atomY(i);
                let x2, y2;

                if (b.from === i) {
                    x2 = this.atomX(b.to);
                    y2 = this.atomY(b.to);
                } else {
                    x2 = this.atomX(b.from);
                    y2 = this.atomY(b.from);
                }

                const dt = Math.atan2(y2 - y1, x2 - x1);
                let tmp = Math.abs(dt - 0);

                if (tmp > Math.PI * 2) {
                    tmp -= Math.PI * 2;
                }

                right = Math.min(right, tmp);
                tmp = Math.min(Math.abs(dt - Math.PI), Math.abs(dt + Math.PI));

                if (tmp > Math.PI * 2) {
                    tmp -= Math.PI * 2;
                }

                left = Math.min(left, tmp);
                tmp = Math.abs(dt - Math.PI / 2);

                if (tmp > Math.PI * 2) {
                    tmp -= Math.PI * 2;
                }

                top = Math.min(top, tmp);
                tmp = Math.abs(dt + Math.PI / 2);

                if (tmp > Math.PI * 2) {
                    tmp -= Math.PI * 2;
                }

                bottom = Math.min(bottom, tmp);
            }

            if (right > 1.0) {
                atom.spareSpace = Direction.RIGHT;
            } else if (left > 1.4) {
                atom.spareSpace = Direction.LEFT;
            } else {
                const max = Math.max(Math.max(top, bottom), Math.max(left, right));

                if (max === right) {
                    atom.spareSpace = Direction.RIGHT;
                } else if (max === left) {
                    atom.spareSpace = Direction.LEFT;
                } else if (max === bottom) {
                    atom.spareSpace = Direction.BOTTOM;
                } else if (max === top) {
                    atom.spareSpace = Direction.TOP;
                }
            }
        }

        let sum = 0;
        let a1, a2;

        for (const b of this.bonds) {
            a1 = this.atoms[b.from - 1];
            a2 = this.atoms[b.to - 1];
            sum += Math.hypot(a1.x - a2.x, a1.y - a2.y);
        }

        this.avgBondLength = sum / this.bonds.length;
    }
}

export {
    Molecule,
    Atom,
    Bond,
    Direction,
    ShowFlag
};
