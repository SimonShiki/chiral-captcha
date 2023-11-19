import { Molecule, Bond } from './molecule';

export function getMoleculeChiralCarbons (mol: Molecule) {
    const ret = new Set<number>();
    for (let i = 1; i <= mol.atoms.length; i++) {
        if (isChiralCarbon(mol, i)) {
            ret.add(i);
        }
    }
    return ret;
}

export function isChiralCarbon (mol: Molecule, index: number) {
    const atom = mol.getAtom(index);

    // Check if the atom is carbon
    if (atom.element !== 'C') {
        return false;
    }

    const bonds: Bond[] = mol.getAtomDeclaredBonds(index);

    // Check if all bonded atoms have single bonds
    for (const b of bonds) {
        if (b.type > 1) {
            return false;
        }
    }

    let hcnt = atom.hydrogenCount;
    const bondnh: Bond[] = [];

    for (let i = 0; i < bonds.length; i++) {
        const b = bonds[i];
        const another = (b.from === index) ? b.to : b.from;

        // Check for hydrogen atoms with a single bond
        if (mol.getAtom(another).element === 'H' && mol.getAtomDeclaredBonds(another).length === 1) {
            hcnt++;
        } else {
            bondnh.push(b);
        }
    }

    // Check chirality based on the number and type of bonds
    if (bondnh.length === 4 && hcnt === 0) {
        const b1 = mol.getBondId(bondnh[0]);
        const b2 = mol.getBondId(bondnh[1]);
        const b3 = mol.getBondId(bondnh[2]);
        const b4 = mol.getBondId(bondnh[3]);

        return !(compareChain(mol, index, b1, b2) || compareChain(mol, index, b1, b3)
                || compareChain(mol, index, b1, b4)
                || compareChain(mol, index, b2, b3) || compareChain(mol, index, b2, b4)
                || compareChain(mol, index, b3, b4));
    } else if (bondnh.length === 3 && hcnt === 1) {
        const b1 = mol.getBondId(bondnh[0]);
        const b2 = mol.getBondId(bondnh[1]);
        const b3 = mol.getBondId(bondnh[2]);

        return !(compareChain(mol, index, b1, b2) || compareChain(mol, index, b1, b3)
                || compareChain(mol, index, b3, b2));
    } 
    return false;
    
}

function compareChain (mol: Molecule, center: number, chain1: number, chain2: number): boolean;
function compareChain (mol: Molecule, atom1: number, atom2: number, chain1: number, chain2: number, ttl: number): boolean;

function compareChain (mol: Molecule, atom1: number, atom2: number, chain1: number, chain2?: number, ttl?: number) {
    // Overload function
    if (!ttl || !chain2) {
        chain2 = chain1;
        chain1 = atom2;
        atom2 = atom1;
        ttl = Math.floor(3 + Math.sqrt(mol.atoms.length));
    }

    const b1 = mol.getBond(chain1);
    const b2 = mol.getBond(chain2);

    // Check if bond types match
    if (b1.type !== b2.type) {
        return false;
    }

    const another1 = (b1.from === atom1) ? b1.to : b1.from;
    const another2 = (b2.from === atom2) ? b2.to : b2.from;

    const a1 = mol.getAtom(another1);
    const a2 = mol.getAtom(another2);

    // Check if bonded atoms have the same element
    if (a1.element !== a2.element) {
        return false;
    }

    let hcnt1 = a1.hydrogenCount;
    let hcnt2 = a2.hydrogenCount;

    const bonds1 = mol.getAtomDeclaredBonds(another1);
    const bonds2 = mol.getAtomDeclaredBonds(another2);

    const bondnh1: Bond[] = [];
    const bondnh2: Bond[] = [];

    for (const b of bonds1) {
        const another = (b.from === another1) ? b.to : b.from;

        // Check for hydrogen atoms with a single bond
        if (another === atom1) {
            continue;
        }

        if (mol.getAtom(another).element === 'H' && mol.getAtomDeclaredBonds(another).length === 1) {
            hcnt1++;
        } else {
            bondnh1.push(b);
        }
    }

    for (const b of bonds2) {
        const another = (b.from === another2) ? b.to : b.from;

        // Check for hydrogen atoms with a single bond
        if (another === atom2) {
            continue;
        }

        if (mol.getAtom(another).element === 'H' && mol.getAtomDeclaredBonds(another).length === 1) {
            hcnt2++;
        } else {
            bondnh2.push(b);
        }
    }

    // Check hydrogen count and bond count
    if (hcnt1 !== hcnt2 || bondnh1.length !== bondnh2.length) {
        return false;
    }

    // Check recursively with decreased TTL
    if (ttl < 0) {
        return true;
    }

    ttl--;

    for (const dchain1 of bondnh1) {
        let success = false;
        for (const bond of bondnh2) {
            if (compareChain(mol, another1, another2, mol.getBondId(dchain1),
                mol.getBondId(bond), ttl)) {
                success = true;
                break;
            }
        }
        if (!success) {
            return false;
        }
    }

    return true;
}
