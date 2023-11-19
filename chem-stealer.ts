import axios from 'axios';
import { parseMdlMolString } from './src/mdlmol-parser';
import { MoleculeRenderer } from './src/render';
import fs from 'node:fs/promises';

const PUB_CHEM_SITE = 'https://pubchem.ncbi.nlm.nih.gov';
async function nextRandomMolecule () {
    for (let retry = 5; retry > 0; retry--) {
        const cid = Math.floor(Math.random() * 100000000 + Math.random() * 10000000 + Math.random() * 100000 + 100000);
        try {
            return await getMoleculeByCid(cid);
        } catch (error) {
            console.error(error);
            retry--;
        }
    }
    return null;
}
    
async function getMoleculeByCid (cid: number) {
    try {
        const response = await axios.get(`${PUB_CHEM_SITE}/rest/pug/compound/CID/${cid}/record/SDF/?record_type=2d&response_type=display`, {
            timeout: 10000,
        });

        if (response.status !== 200) {
            throw new Error(`Bad ResponseCode: ${response.status}`);
        }

        return parseMdlMolString(response.data);
    } catch (error: unknown) {
        throw new Error(`Failed to fetch molecule: ${(error as Error).message}`);
    }
}

(async function(){
for (let i = 0; i < 10; i++) {
    const molecule = await nextRandomMolecule();
    if (!molecule) continue;
    const renderer = new MoleculeRenderer(molecule);
    const buffer = renderer.render();
    await fs.writeFile(`dist/${i}.png`, buffer);
    console.log(i)
}
})();
