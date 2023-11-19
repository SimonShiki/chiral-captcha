import { Molecule, Atom, Bond, ShowFlag } from './molecule';

export function parseMdlMolString (str: string) {
    let start = -1;
    const atoms: Atom[] = [];
    const bonds: Bond[] = [];

    // Replace carriage return and split the input string into lines
    const lines = str.replace('\r\n', '\n').replace('\r', '\n').split('\n');

    // Find the line that starts with "V2000"
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length >= 39 && line.startsWith('V2000', 34)) {
            start = i;
            break;
        }
    }

    // Throw an exception if "V2000" tag is not found
    if (start === -1) {
        throw new Error('V2000 tag not found');
    }

    // Parse the number of atoms and bonds from the start line
    const numAtoms = parseInt(lines[start].substring(0, 3).trim(), 10);
    const numBonds = parseInt(lines[start].substring(3, 6).trim(), 10);

    // Parse atom information
    for (let i = 0; i < numAtoms; i++) {
        const atom = new Atom();
        atoms[i] = atom;
        const line = lines[start + 1 + i];

        // Throw an exception for invalid atom line
        if (line.length < 39) {
            throw new Error('Invalid MDL MOL: atom line' + (start + 2 + i));
        }

        // Parse atom properties
        atom.x = parseFloat(line.substring(0, 10).trim());
        atom.y = parseFloat(line.substring(10, 20).trim());
        atom.z = parseFloat(line.substring(20, 30).trim());
        atom.element = line.substring(31, 34).trim();

        // Parse additional atom properties
        const chg2 = parseInt(line.substring(36, 39).trim(), 10);
        const mapnum = line.length < 63 ? 0 : parseInt(line.substring(60, 63).trim(), 10);
        let chg, rad = 0;

        // Determine atom charge and unpaired values
        if (chg2 >= 1 && chg2 <= 3) {
            chg = 4 - chg2;
        } else if (chg2 === 4) {
            chg = 0;
            rad = 2;
        } else if (chg2 < 5 || chg2 > 7) {
            chg = 0;
        } else {
            chg = 4 - chg2;
        }

        atom.charge = chg;
        atom.unpaired = rad;
        atom.mapnum = mapnum;
    }

    // Parse bond information
    for (let i = 0; i < numBonds; i++) {
        const bond = new Bond();
        bonds[i] = bond;
        const line = lines[start + numAtoms + 1 + i];

        // Throw an exception for invalid bond line
        if (line.length < 12) {
            throw new Error('Invalid MDL MOL: bond line' + (start + numAtoms + 2 + i));
        }

        // Parse bond properties
        const from = parseInt(line.substring(0, 3).trim(), 10);
        const to = parseInt(line.substring(3, 6).trim(), 10);
        const type = parseInt(line.substring(6, 9).trim(), 10);
        const stereo = parseInt(line.substring(9, 12).trim(), 10);

        // Validate bond properties
        if (from === to || from < 1 || from > numAtoms || to < 1 || to > numAtoms) {
            throw new Error('Invalid MDL MOL: bond line' + (start + numAtoms + 2 + i));
        }

        const order = (type < 1 || type > 3) ? 1 : type;
        let style = 0;

        // Determine bond stereo direction
        if (stereo === 1) {
            style = 1;
        } else if (stereo === 6) {
            style = 2;
        }

        bond.from = from;
        bond.to = to;
        bond.type = order;
        bond.stereoDirection = style;
    }

    // Process additional information in the M block
    const molecule = new Molecule(atoms, bonds, str);
    for (let i = start + numAtoms + numBonds + 1; i < lines.length; i++) {
        const line = lines[i];

        // Break if the line starts with "M  END"
        if (line.startsWith('M  END')) {
            break;
        }

        let type2 = 0;

        // Determine the type of M block
        if (line.startsWith('M  CHG')) {
            type2 = 1;
        } else if (line.startsWith('M  RAD')) {
            type2 = 2;
        } else if (line.startsWith('M  ISO')) {
            type2 = 3;
        } else if (line.startsWith('M  RGP')) {
            type2 = 4;
        } else if (line.startsWith('M  HYD')) {
            type2 = 5;
        } else if (line.startsWith('M  ZCH')) {
            type2 = 6;
        } else if (!line.startsWith('M  ZBO')) {
            let anum = 0;

            // Attempt to parse atom number
            try {
                anum = parseInt(line.substring(3, 6).trim(), 10);
            } catch (ignored) {
                // eslint-disable-line no-empty
            }

            // Update atom element in A block
            if (line.startsWith('A  ') && line.length >= 6 && anum >= 1 && anum <= numAtoms) {
                const line5 = lines[++i];
                if (line5 === null) {
                    break;
                }
                molecule.getAtom(anum).element = line5;
            }
        } else {
            type2 = 7;
        }

        // Process M block information
        if (type2 > 0) {
            try {
                const len = parseInt(line.substring(6, 9).trim(), 10);

                // Iterate over M block data
                for (let n3 = 0; n3 < len; n3++) {
                    const pos = parseInt(line.substring(n3 * 8 + 9, n3 * 8 + 13).trim(), 10);
                    const val = parseInt(line.substring(n3 * 8 + 13, n3 * 8 + 17).trim(), 10);

                    // Throw an exception for invalid M block data
                    if (pos < 1) {
                        throw new Error('Invalid MDL MOL: M-block');
                    }

                    // Update atom charge, unpaired, isotope, element, or bond stereo direction
                    if (type2 === 1) {
                        molecule.getAtom(pos).charge = val;
                    } else if (type2 === 2) {
                        molecule.getAtom(pos).unpaired = val;
                    } else if (type2 === 3) {
                        molecule.getAtom(pos).isotope = val;
                    } else if (type2 === 4) {
                        molecule.getAtom(pos).element = 'R' + val;
                    } else if (type2 === 5) {
                        molecule.getAtom(pos).showFlag = ShowFlag.EXPLICIT;
                    } else if (type2 === 6) {
                        molecule.getAtom(pos).charge = val;
                    } else if (type2 === 7) {
                        molecule.getBond(pos).stereoDirection = val;
                    }
                }
                continue;
            } catch (e) {
                throw new Error('Invalid MDL MOL: M-block');
            }
        }
    }

    // Initialize the molecule and return it
    molecule.initOnce();
    return molecule;
}
    
